import {ClientSession, PipelineStage, Types} from 'mongoose';
import {CreateCampaignInvoiceDto, CreateInvoiceDto} from './dto/create-invoice.dto';
import {
    BadRequestException,
    ForbiddenException,
    Injectable, InternalServerErrorException,
    Logger,
    NotFoundException,
    StreamableFile
} from '@nestjs/common';
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {UserInvoiceRepository} from "../../database/repositories/invoices/user-invoice.repository";
import {GetInvoicesQueryDto} from "./dto/invoice.dto";
import {
    InvoiceForDashboard,
} from "../../common/types/influencer/invoice.types";
import {formatDate} from "../../common/utils/formatters";
import {ClientRepository} from "../../database/repositories/users/client.repository";
import {EmailService} from "../email/email.service";
import {InvoiceDetailsRepository} from "../../database/repositories/invoices/invoice-details.repository";
import {Role, UserPayload} from "../../common/types/user.types";
import {ObjId} from "../../common/types/base.types";
import {UkBankTransferDetailsRepository} from "../../database/repositories/invoices/uk-transfer-details.repository";
import {
    InternationalBankTransferDetailsRepository
} from "../../database/repositories/invoices/international-transfer-details.repository";
import {PaypalDetailsRepository} from "../../database/repositories/invoices/paypal-details.repository";
import {PaymentMethodRequestEnum} from "../profile/dto/payment-details.dto";
import {ProfileService} from "../profile/profile.service";
import {mapToInvoiceModel} from "../../common/mappers/invoice.mapper";
import {InvoicePdfExporter} from "../../common/utils/export/pdf/invoice-pdf.exporter";

@Injectable()
export class InvoiceService {
    constructor(
        // users
        private readonly influencerRepo: InfluencerRepository,
        private readonly clientRepo: ClientRepository,
        // invoices
        private readonly userInvoiceRepository: UserInvoiceRepository,
        // invoice details
        private readonly invoiceDetailsRepo: InvoiceDetailsRepository,
        // payment details
        private readonly ukTransferDetailsRepo: UkBankTransferDetailsRepository,
        private readonly internationalTransferDetailsRepo: InternationalBankTransferDetailsRepository,
        private readonly paypalDetailsRepo: PaypalDetailsRepository,
        // services
        private readonly influencerHistoryService: InfluencerActionsHistoryService,
        private readonly profileService: ProfileService,
        private readonly emailService: EmailService
    ) {
    }

    private readonly logger = new Logger("InvoiceService");

    async createInfluencerInvoice(data: CreateInvoiceDto): Promise<void> {
        const influencer = await this.influencerRepo.findById(data.userId);

        if (!influencer) throw new NotFoundException('Influencer not found');

        const session = await this.influencerRepo.startSession();
        session.startTransaction();

        try {
            const amount = Number(data.amount);

            const updatedInfluencer = await this.influencerRepo.findOneAndUpdate(
                {
                    _id: new Types.ObjectId(data.userId),
                    balance: {$gte: amount},
                },
                {$inc: {balance: -amount}},
                {new: true, session}
            );

            if (!updatedInfluencer) {
                throw new BadRequestException('Insufficient balance');
            }

            const newBalance = Number(updatedInfluencer.balance);

            // Creating invoice
            const invoice = await this.userInvoiceRepository.create(mapToInvoiceModel(data), {session});

            // Updating influencer's actions history
            await this.influencerHistoryService.upsertInfluencerInvoiceHistory(
                {
                    influencerId: data.userId,
                    invoiceId: invoice._id.toString(),
                    paymentMethod: data.selectedPaymentMethod,
                    currentBalance: newBalance,
                    amount: data.amount,
                },
                session
            );

            // Mapping accounts name for email
            const instagramAccounts = influencer.instagram
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const tiktokAccounts = influencer.tiktok
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const spotifyAccounts = influencer.spotify
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const soundcloudAccounts = influencer.soundcloud
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const facebookAccounts = influencer.facebook
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const youtubeAccounts = influencer.youtube
                .map((account) => `<br /> - ${account.username}`)
                .join('');
            const pressAccounts = influencer.press
                .map((account) => `<br /> - ${account.username}`)
                .join('');

            // Creating and sending email
            const pdfInvoice = await InvoicePdfExporter.buildPdfBuffer(invoice)
            await this.emailService.sendNewInfluencerInvoiceEmail({
                influencerEmail: influencer.email,
                instagramAccounts,
                tiktokAccounts,
                spotifyAccounts,
                soundcloudAccounts,
                facebookAccounts,
                youtubeAccounts,
                pressAccounts,
                selectedPaymentMethod: data.selectedPaymentMethod
            }, pdfInvoice);

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }

    // todo: update after designer finish design for invoices
    async createClientCampaignInvoice(data: CreateCampaignInvoiceDto, session?: ClientSession): Promise<void> {
        const invoice = mapToInvoiceModel(data);

        if (!invoice) throw new BadRequestException('Invalid payment details');

        await this.userInvoiceRepository.create(invoice, {session});

        const pdfInvoice = await InvoicePdfExporter.buildPdfBuffer(invoice)
        await this.emailService.sendClientCampaignInvoiceEmail(pdfInvoice);
    }

    async getInvoices(
        data: GetInvoicesQueryDto,
        userInfo: UserPayload,
    ): Promise<InvoiceForDashboard[]> {
        const { limit, page } = data;

        const userId = new ObjId(userInfo._id);
        const userRole = userInfo.role;

        const skip = (page - 1) * limit;

        const pipeline: PipelineStage[] = [
            { $match: { userId, userRole } },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },

            {
                $addFields: {
                    needCampaignNameLookup: {
                        $and: [
                            { $eq: ['$userRole', 'client'] },
                            { $eq: [{ $ifNull: ['$campaignName', null] }, null] },
                        ],
                    },
                },
            },

            {
                $lookup: {
                    from: 'campaigns',
                    let: { cid: '$campaignId', need: '$needCampaignNameLookup' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        '$$need',
                                        { $eq: ['$_id', '$$cid'] },
                                    ],
                                },
                            },
                        },
                        { $project: { _id: 0, campaignName: 1 } },
                        { $limit: 1 },
                    ],
                    as: 'campaignDoc',
                },
            },

            {
                $lookup: {
                    from: 'completedcampaigns',
                    let: { cid: '$campaignId', need: '$needCampaignNameLookup' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        '$$need',
                                        { $eq: ['$_id', '$$cid'] },
                                    ],
                                },
                            },
                        },
                        { $project: { _id: 0, campaignName: 1 } },
                        { $limit: 1 },
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
                                    { $first: '$campaignDoc.campaignName' },
                                    { $first: '$completedCampaignDoc.campaignName' },
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
                    shortInvoiceId: { $substr: [{ $toString: '$_id' }, 0, 8] },
                    creationDate: { $dateToString: { date: '$createdAt', format: '%d.%m.%Y' } },
                    paymentMethod: '$selectedPaymentMethod',
                    amount: 1,
                    status: 1,

                    campaignName: {
                        $cond: [
                            { $eq: ['$userRole', 'client'] },
                            '$campaignNameResolved',
                            '$$REMOVE',
                        ],
                    },
                },
            },
        ];

        return this.userInvoiceRepository.aggregate(pipeline);
    }

    async downloadInvoice(invoiceId: string, userInfo: UserPayload) {
        const invoice = await this.userInvoiceRepository.findById(invoiceId);

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

    async getInvoiceDraft(userInfo: UserPayload): Promise<CreateInvoiceDto> {
        const influencerId = userInfo._id;

        const influencerBalance = await this.influencerRepo.findById(influencerId, {select: ['balance']});

        if (!influencerBalance) {
            throw new NotFoundException('Influencer not found');
        }
        if (influencerBalance.balance <= 0) {
            throw new ForbiddenException('Balance must be greater than 0');
        }

        const invoiceDetails = await this.invoiceDetailsRepo.findOne({
            userId: new Types.ObjectId(influencerId),
            userRole: Role.influencer
        }, {
            lean: true
        });

        const paymentDetails = await this.profileService.getPaymentDetails(userInfo, PaymentMethodRequestEnum.all)
        let latestInvoice = null;

        if (!paymentDetails.ukBankTransfer && !paymentDetails.internationalBankTransfer && !paymentDetails.paypal) {
            latestInvoice = await this.userInvoiceRepository.findOne({
                influencerId: new Types.ObjectId(influencerId)
            }, {
                lean: true,
                sort: ({createdAt: -1})
            })
        }

        return {
            firstName: invoiceDetails.firstName ?? latestInvoice?.firstName ?? null,
            lastName: invoiceDetails.lastName ?? latestInvoice?.lastName ?? null,
            address: invoiceDetails.address ?? latestInvoice?.address ?? null,
            country: invoiceDetails.country ?? latestInvoice?.country ?? null,
            company: invoiceDetails.company ?? latestInvoice?.company ?? null,
            vatNumber: invoiceDetails.vatNumber ?? latestInvoice?.vatNumber ?? null,
            amount: influencerBalance.balance,
            selectedPaymentMethod: latestInvoice?.selectedPaymentMethod ?? null,
            ukBankTransfer: paymentDetails.ukBankTransfer ?? latestInvoice?.ukBankTransfer ?? null,
            internationalBankTransfer: paymentDetails.internationalBankTransfer ?? latestInvoice?.internationalBankTransfer ?? null,
            paypal: paymentDetails.paypal ?? latestInvoice?.paypal ?? null
        }
    }
}
