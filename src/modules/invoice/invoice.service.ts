import {ClientSession, PipelineStage, Types} from 'mongoose';
import {CreateCampaignInvoiceDto, CreateInvoiceDto} from './dto/create-invoice.dto';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    StreamableFile
} from '@nestjs/common';
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {UserInvoiceRepository} from "../../database/repositories/invoices/user-invoice.repository";
import {GetInvoicesQueryDto} from "./dto/invoice.dto";
import {
    ClientDetailedInvoice,
    InvoiceForDashboard,
    InvoicePaymentMethodEnum,
    InvoiceStatusEnum,
} from "../../common/types/invoice.types";
import {EmailService} from "../../integrations/email/email.service";
import {InvoiceDetailsRepository} from "../../database/repositories/invoices/invoice-details.repository";
import {Role, UserPayload} from "../../common/types/user.types";
import {ObjId} from "../../common/types/base.types";
import {PaymentMethodRequestEnum} from "../profile/dto/payment-details.dto";
import {ProfileService} from "../profile/services/profile.service";
import {InvoicePdfExporter} from "../../common/utils/export/pdf/invoice-pdf.exporter";
import {InfluencerToAdminEmails} from "../../integrations/email/email.templates";
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {mapPromosToInvoiceLinkedPromos, mapToDetailedInvoice} from "../../common/mappers/invoice.mapper";
import {
    ClientInvoiceDocument,
    InfluencerInvoiceDocument
} from "../../database/schemas/invoices/user-invoice.schema";
import {formatDate} from "../../common/utils/formatters";
import {UpdateClientInvoiceDto} from "./dto/update-invoice.dto";
import {PaymentHistoryAdminOverrideStatusEnum, PaymentHistorySystemStatusEnum} from "../../common/types/history.types";
import {PaymentsHistoryService} from "../payments-history/payments-history.service";
import {InvoiceDetails} from "../../database/schemas/invoices/invoice-details.schema";

@Injectable()
export class InvoiceService {
    constructor(
        // repositories
        private readonly influencerRepo: InfluencerRepository,
        private readonly userInvoiceRepository: UserInvoiceRepository,
        private readonly invoiceDetailsRepo: InvoiceDetailsRepository,
        private readonly campaignRepo: CampaignRepository,
        // services
        private readonly influencerHistoryService: InfluencerActionsHistoryService,
        private readonly profileService: ProfileService,
        private readonly emailService: EmailService,
        private readonly paymentsHistoryService: PaymentsHistoryService,
    ) {
    }

    private readonly logger = new Logger("InvoiceService");

    // Creates new influencer invoice
    async createInfluencerInvoice(data: CreateInvoiceDto): Promise<void> {
        const session = await this.influencerRepo.startSession();
        session.startTransaction();

        try {
            // Getting influencer
            const influencerForPayment = await this.influencerRepo.findById(data.userId, {
                session,
                select: ['balance']
            });

            if (!influencerForPayment) {
                throw new NotFoundException('Influencer not found');
            }

            // Saving old balance
            const oldBalance = Number(influencerForPayment.balance);

            if (oldBalance <= 0) {
                throw new BadRequestException('Insufficient balance');
            }

            // Searching promos that were closed and waiting for payment
            const promosWaitForPayment = await this.campaignRepo.findAllWaitingForPayment(data.userId, InvoiceStatusEnum.wait, session)

            if (!promosWaitForPayment || promosWaitForPayment.length === 0) {
                throw new NotFoundException(`Can't find any promo that is waiting for payment`);
            }

            // Updating invoice status in these promos
            await this.campaignRepo.updateManyInvoiceStatusesByStatus(data.userId, InvoiceStatusEnum.wait, InvoiceStatusEnum.submitted, session);

            // throw new Error('expected error');

            // Creating invoice
            const invoice: InfluencerInvoiceDocument = await this.userInvoiceRepository.createInfluencerInvoice({
                ...data,
                linkedPromos: mapPromosToInvoiceLinkedPromos(promosWaitForPayment),
                amount: oldBalance
            }, session);

            // Updating influencer's actions history - ADDING CAMPAIGN ACTIONS
            await this.influencerHistoryService.upsertInfluencerCampaignActionsHistoryMany({
                    influencerId: data.userId,
                    updatedCampaignActions: promosWaitForPayment.map(p => ({
                        campaignId: p.campaignId.toString(),
                        campaignName: p.campaignName,
                        addedAccountsId: p._id,
                        socialAccountId: p.accountId,
                        actionNumber: 3,
                        networkUsername: p.username,
                        rewardForInfluencer: p.price,
                        socialMedia: p.socialMedia
                    }))
                },
                session
            );

            // Updating influencer's balance
            const updatedInfluencer = await this.influencerRepo.findOneAndUpdate(
                {
                    _id: new Types.ObjectId(data.userId),
                    balance: oldBalance, // defend from races
                },
                {
                    $set: {balance: 0}, // set zero
                },
                {new: true, session}
            );

            if (!updatedInfluencer || updatedInfluencer.balance !== 0) {
                throw new BadRequestException('Failed to update balance');
            }

            const newBalance = Number(updatedInfluencer.balance);

            // Updating influencer's actions history - ADDING INVOICE ACTION
            await this.influencerHistoryService.upsertInfluencerInvoiceHistory(
                {
                    influencerId: data.userId,
                    invoiceId: invoice._id.toString(),
                    paymentMethod: data.selectedPaymentMethod,
                    currentBalance: newBalance,
                    amount: oldBalance,
                },
                session
            );

            // Building cells info for updating in payment history cell collection
            const cellsInfo: {
                campaignId: string;
                accountId: string;
                newAdminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
                newSystemStatus?: PaymentHistorySystemStatusEnum;
            }[] = promosWaitForPayment.map(i => ({
                campaignId: i.campaignId.toString(),
                accountId: i.accountId.toString(),
                newSystemStatus: PaymentHistorySystemStatusEnum.done
            }));

            // Update each payment history cell for each linked promo
            await this.paymentsHistoryService.rebuildSpecifiedCells({
                session: session,
                cellsInfo: cellsInfo
            })

            // Mapping accounts name for email
            const instagramAccounts = updatedInfluencer.instagram
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const tiktokAccounts = updatedInfluencer.tiktok
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const spotifyAccounts = updatedInfluencer.spotify
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const soundcloudAccounts = updatedInfluencer.soundcloud
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const facebookAccounts = updatedInfluencer.facebook
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const youtubeAccounts = updatedInfluencer.youtube
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const pressAccounts = updatedInfluencer.press
                .map((account) => `<br /> - ${account.username}`)
                .join('');

            // Creating and sending email
            const pdfInvoice = await InvoicePdfExporter.buildPdfBuffer(invoice)
            await this.emailService.send(InfluencerToAdminEmails.newInvoice({
                influencerEmail: updatedInfluencer.email,
                instagramAccounts,
                tiktokAccounts,
                spotifyAccounts,
                soundcloudAccounts,
                facebookAccounts,
                youtubeAccounts,
                pressAccounts,
                selectedPaymentMethod: data.selectedPaymentMethod
            }, pdfInvoice));

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }

    // Creates new client invoice (after creating new campaign)
    async createClientCampaignInvoice(data: CreateCampaignInvoiceDto, session?: ClientSession): Promise<void> {
        const invoiceDetails = await this.invoiceDetailsRepo.findOne({
            userId: new ObjId(data.userId),
            userRole: data.userRole
        }, {session});

        if (!invoiceDetails) {
            await this.invoiceDetailsRepo.create<InvoiceDetails>({
                _id: new ObjId(),
                userId: new ObjId(data.userId),
                userRole: data.userRole,
                firstName: data.firstName,
                lastName: data.lastName,
                address: data.address,
                country: data.country,
                company: data.company,
                vatNumber: data.vatNumber
            }, {session})
        }

        const invoice = await this.userInvoiceRepository.createClientInvoice(data, session);

        // const pdfInvoice = await InvoicePdfExporter.buildPdfBuffer(invoice);
        // await this.emailService.send(AdminToClientEmails.campaignInvoice(process.env.EMAIL_USER, pdfInvoice));
    }

    // Returns list of invoices (sorted from newest)
    async getInvoices(
        data: GetInvoicesQueryDto,
        userInfo: UserPayload,
    ): Promise<InvoiceForDashboard[]> {
        const {limit, page} = data;

        const userId = new ObjId(userInfo._id);
        const userRole = userInfo.role;

        const skip = (page - 1) * limit;

        const pipeline: PipelineStage[] = [
            {$match: {userId, userRole}},
            {$sort: {createdAt: -1}},
            {$skip: skip},
            {$limit: limit},

            {
                $addFields: {
                    needCampaignNameLookup: {
                        $and: [
                            {$eq: ['$userRole', 'client']},
                            {$eq: [{$ifNull: ['$campaignName', null]}, null]},
                        ],
                    },
                },
            },

            {
                $lookup: {
                    from: 'campaigns',
                    let: {cid: '$campaignId', need: '$needCampaignNameLookup'},
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        '$$need',
                                        {$eq: ['$_id', '$$cid']},
                                    ],
                                },
                            },
                        },
                        {$project: {_id: 0, campaignName: 1}},
                        {$limit: 1},
                    ],
                    as: 'campaignDoc',
                },
            },

            {
                $lookup: {
                    from: 'completedcampaigns',
                    let: {cid: '$campaignId', need: '$needCampaignNameLookup'},
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        '$$need',
                                        {$eq: ['$_id', '$$cid']},
                                    ],
                                },
                            },
                        },
                        {$project: {_id: 0, campaignName: 1}},
                        {$limit: 1},
                    ],
                    as: 'completedCampaignDoc',
                },
            },

            {
                $addFields: {
                    campaignNameResolved: {
                        $ifNull: [
                            '$campaignName',
                            {
                                $ifNull: [
                                    {$first: '$campaignDoc.campaignName'},
                                    {$first: '$completedCampaignDoc.campaignName'},
                                ],
                            },
                        ],
                    },
                },
            },

            {
                $project: {
                    _id: 0,
                    invoiceId: {$toString: '$_id'},
                    shortInvoiceId: {$substr: [{$toString: '$_id'}, 0, 8]},
                    creationDate: {$dateToString: {date: '$createdAt', format: '%d.%m.%Y'}},
                    paymentMethod: '$selectedPaymentMethod',
                    amount: 1,
                    status: 1,

                    campaignName: {
                        $cond: [
                            {$eq: ['$userRole', 'client']},
                            '$campaignNameResolved',
                            '$$REMOVE',
                        ],
                    },
                },
            },
        ];

        return this.userInvoiceRepository.aggregate(pipeline);
    }

    // Downloads user's invoice
    async downloadInvoice(invoiceId: string, userInfo: UserPayload) {
        const invoice: ClientInvoiceDocument | InfluencerInvoiceDocument = await this.userInvoiceRepository.findInvoiceById(invoiceId);

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        const isAdmin = userInfo.role === Role.admin;
        const isOwner = userInfo._id === invoice.userId.toString();

        if (!isAdmin && !isOwner) {
            throw new ForbiddenException('You can download only your invoices');
        }

        try {
            const pdf = await InvoicePdfExporter.buildPdfBuffer(invoice);

            return new StreamableFile(pdf, {
                type: 'application/pdf',
                disposition: `attachment; filename=invoice-${formatDate(invoice.createdAt, '-')}.pdf`,
            });
        } catch (error) {
            this.logger.error(`Error build pdf for ${userInfo.role} invoice ${invoiceId}`, error);
            throw new InternalServerErrorException("Can't build pdf for this invoice");
        }
    }

    // Returns draft values for invoice fields
    async getInvoiceDraft(userInfo: UserPayload): Promise<CreateInvoiceDto> {
        const influencerId = userInfo._id;

        const influencerBalance = await this.influencerRepo.findById(influencerId, {select: ['balance']});

        if (!influencerBalance) {
            throw new NotFoundException('Influencer not found');
        }
        // if (influencerBalance.balance <= 0) {
        //     throw new ForbiddenException('Balance must be greater than 0');
        // }

        const invoiceDetails = await this.invoiceDetailsRepo.findOne({
            userId: new Types.ObjectId(influencerId),
            userRole: Role.influencer
        }, {
            lean: true
        });

        let paymentDetails = await this.profileService.getPaymentDetails(userInfo, PaymentMethodRequestEnum.all)
        let latestInvoice = null;

        if (!paymentDetails.ukBankTransfer) {
            const latestUkBankTransfer = await this.userInvoiceRepository.findOne({
                userId: new Types.ObjectId(influencerId),
                selectedPaymentMethod: InvoicePaymentMethodEnum.ukBankTransfer
            }, {
                lean: true,
                sort: ({createdAt: -1}),
            })

            if (latestUkBankTransfer) {
                paymentDetails.ukBankTransfer = {
                    beneficiary: latestUkBankTransfer.ukBankTransfer.beneficiary,
                    beneficiaryAddress: latestUkBankTransfer.ukBankTransfer.beneficiaryAddress,
                    sortCode: latestUkBankTransfer.ukBankTransfer.sortCode,
                    accountNumber: latestUkBankTransfer.ukBankTransfer.accountNumber
                }

                latestInvoice = latestUkBankTransfer;
            }
        }

        if (!paymentDetails.internationalBankTransfer) {
            const latestInternationalBankTransfer = await this.userInvoiceRepository.findOne({
                userId: new Types.ObjectId(influencerId),
                selectedPaymentMethod: InvoicePaymentMethodEnum.internationalBankTransfer
            }, {
                lean: true,
                sort: ({createdAt: -1}),
            })

            if (latestInternationalBankTransfer) {
                paymentDetails.internationalBankTransfer = {
                    beneficiary: latestInternationalBankTransfer.internationalBankTransfer.beneficiary,
                    beneficiaryAddress: latestInternationalBankTransfer.internationalBankTransfer.beneficiaryAddress,
                    iban: latestInternationalBankTransfer.internationalBankTransfer.iban,
                    bankName: latestInternationalBankTransfer.internationalBankTransfer.bankName,
                    bankCountry: latestInternationalBankTransfer.internationalBankTransfer.bankCountry,
                    bankAccountCurrency: latestInternationalBankTransfer.internationalBankTransfer.bankAccountCurrency,
                    swiftBicCode: latestInternationalBankTransfer.internationalBankTransfer.swiftBicCode,
                }

                if (!latestInvoice || latestInternationalBankTransfer.createdAt.getTime() > latestInvoice.createdAt.getTime()) {
                    latestInvoice = latestInternationalBankTransfer;
                }
            }
        }

        if (!paymentDetails.paypal) {
            const latestPaypal = await this.userInvoiceRepository.findOne({
                userId: new Types.ObjectId(influencerId),
                selectedPaymentMethod: InvoicePaymentMethodEnum.paypal
            }, {
                lean: true,
                sort: ({createdAt: -1}),
            })

            if (latestPaypal) {
                paymentDetails.paypal = {
                    paypalEmail: latestPaypal.paypal.paypalEmail,
                }

                if (!latestInvoice || latestPaypal.createdAt.getTime() > latestInvoice.createdAt.getTime()) {
                    latestInvoice = latestPaypal;
                }
            }
        }

        return {
            firstName: invoiceDetails?.firstName ?? latestInvoice?.firstName ?? null,
            lastName: invoiceDetails?.lastName ?? latestInvoice?.lastName ?? null,
            address: invoiceDetails?.address ?? latestInvoice?.address ?? null,
            country: invoiceDetails?.country ?? latestInvoice?.country ?? null,
            company: invoiceDetails?.company ?? latestInvoice?.company ?? null,
            vatNumber: invoiceDetails?.vatNumber ?? latestInvoice?.vatNumber ?? null,

            amount: influencerBalance.balance,
            selectedPaymentMethod: latestInvoice?.selectedPaymentMethod ?? null,

            ukBankTransfer: paymentDetails.ukBankTransfer ?? latestInvoice?.ukBankTransfer ?? null,
            internationalBankTransfer:
                paymentDetails.internationalBankTransfer ??
                latestInvoice?.internationalBankTransfer ??
                null,
            paypal: paymentDetails.paypal ?? latestInvoice?.paypal ?? null,
        };
    }

    // Updates user's invoice
    async updateInvoice(invoiceId: string, data: UpdateClientInvoiceDto, userInfo: UserPayload): Promise<void> {
        if (!data.poNumber && !data.company && !data.address && !data.country && !data.vatNumber) {
            throw new BadRequestException('Nothing to update');
        }

        const invoiceToUpdate = await this.userInvoiceRepository.findInvoiceById(invoiceId);

        if (!invoiceToUpdate) {
            throw new NotFoundException('Invoice not found');
        }

        if (invoiceToUpdate.userId.toString() !== userInfo._id && userInfo.role !== Role.admin) {
            throw new ForbiddenException("You don't have permission to update this invoice");
        }

        const updatedInvoice = await this.userInvoiceRepository.updateClientInvoiceById(invoiceId, data);

        if (!updatedInvoice) {
            throw new InternalServerErrorException('Something went wrong. Try again later');
        }
    }

    // Returns detailed invoice
    async getDetailedInvoice(invoiceId: string, userInfo: UserPayload): Promise<ClientDetailedInvoice> {
        if (userInfo.role === Role.influencer) {
            throw new ForbiddenException('Not enough access');
        }

        const invoice = await this.userInvoiceRepository.findInvoiceById(invoiceId);

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        if (invoice.userId.toString() !== userInfo._id && userInfo.role !== Role.admin) {
            throw new ForbiddenException('Not enough access');
        }

        return mapToDetailedInvoice(invoice);
    }
}
