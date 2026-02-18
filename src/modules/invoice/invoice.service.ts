import {ClientSession, PipelineStage, Types} from 'mongoose';
import {CreateCampaignInvoiceDto, CreateInvoiceDto} from './dto/create-invoice.dto';
import {UserInvoice} from '../../database/schemas/invoices/user-invoice.schema';
import {BadRequestException, ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {Response} from 'express';
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {UserInvoiceRepository} from "../../database/repositories/invoices/user-invoice.repository";
import {GetInvoicesQueryDto} from "./dto/invoice.dto";
import {
    InvoiceForDashboard,
    InvoicePaymentMethodEnum,
    InvoiceStatusEnum
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
import {CreateCampaignDto} from "../campaigns/dto/create-campaign.dto";
import {mapToInvoiceModel} from "../../common/mappers/invoice.mapper";
import {InvoicePdfExporter} from "../../common/utils/export/pdf/invoice-pdf.exporter";

const fs = require('fs');
const PDFDocument = require('pdfkit');

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

    private async createPDF(data: UserInvoice) {
        let beneficiary, beneficiaryAddress, paymentMethodDetails;

        switch (data.selectedPaymentMethod) {
            case InvoicePaymentMethodEnum.internationalBankTransfer:
                beneficiary = data?.internationalBankTransfer?.beneficiary;
                beneficiaryAddress = data?.internationalBankTransfer?.beneficiaryAddress;
                paymentMethodDetails = `Bank Name: ${data?.internationalBankTransfer?.bankName}\nBeneficiary: ${data?.internationalBankTransfer?.beneficiary}\nBeneficiary Address: ${data?.internationalBankTransfer?.beneficiaryAddress}\nIBAN: ${data?.internationalBankTransfer?.iban}\nBank Country: ${data?.internationalBankTransfer?.bankCountry}\nBank Account Currency: ${data?.internationalBankTransfer?.bankAccountCurrency}\nSWIFT/BIC: ${data?.internationalBankTransfer?.swiftBicCode}`;
                break;
            case InvoicePaymentMethodEnum.ukBankTransfer:
                beneficiary = data?.ukBankTransfer?.beneficiary;
                beneficiaryAddress = data?.ukBankTransfer?.beneficiaryAddress;
                paymentMethodDetails = `Beneficiary: ${data?.ukBankTransfer?.beneficiary}\nBeneficiary Address: ${data?.ukBankTransfer?.beneficiaryAddress}\nSort Code: ${data?.ukBankTransfer?.sortCode}\nAccount Number: ${data?.ukBankTransfer?.accountNumber}`;
                break;
            case InvoicePaymentMethodEnum.paypal:
                beneficiary = `${data.firstName} ${data.lastName}`;
                beneficiaryAddress = undefined;
                paymentMethodDetails = `Paypal Email: ${data?.paypal?.paypalEmail}`;
                break;
            default:
                throw new BadRequestException(`Unsupported payment method: ${String(data.selectedPaymentMethod)}`);
        }


        const pdfFileName = 'invoice.pdf';
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(pdfFileName);
        doc.pipe(writeStream);

        // Header
        doc.fontSize(20).text('INVOICE', 50, 50);

        // Sender's details
        doc.fontSize(10).text(data.firstName + ' ' + data.lastName, 50, 100);
        doc.text(data.address, 50, 115);
        doc.text(`Postcode: ${data.country}`, 50, 130);
        doc.text(beneficiary, 50, 145);
        if (beneficiaryAddress) doc.text(beneficiaryAddress, 50, 160);

        // Date and Invoice Number
        doc.text(`DATE: ${formatDate(new Date())}`, 400, 100);
        doc.text(`INVOICE NO. ${data?._id}`, 400, 115);

        // Bill To
        doc.text('BILL TO', 50, 200);
        doc.text('TECHNO TV LTD', 50, 215);
        doc.text('Chamber of Commerce: 10458319', 50, 230);
        doc.text('Email Address: admin@soundinfluencers.com', 50, 245);
        doc.text('Phone number: +44 7537 129190', 50, 260);
        doc.text('124 City Road', 50, 275);
        doc.text('EC1V 2NX – London – England - UK', 50, 290);

        // Table headers
        doc.text('DESCRIPTION', 50, 330);
        doc.text('TOTAL', 250, 330);

        // Table content
        doc.text(beneficiary + ' campaign', 50, 350);
        doc.text(data.amount + '€', 250, 350);

        // Payment details
        let currentY = 400;
        doc.text('SUBTOTAL:', 50, currentY);
        doc.text(data.amount + '€', 250, currentY);

        currentY += 15;
        doc.text('BALANCE DUE:', 50, currentY);
        doc.text(data.amount + '€', 250, currentY);

        currentY += 20;
        doc.text('Selected Payment Method: ' + data.selectedPaymentMethod, 50, currentY);

        currentY += 20;
        doc.text(paymentMethodDetails, 50, currentY, {width: 500, continued: false});

        currentY = doc.y + 20;
        doc.text('Payment Terms: Within 7 business days', 50, currentY);

        doc.end();

        return new Promise<string>((resolve, reject) => {
            const done = (err?: unknown) => (err ? reject(err) : resolve(pdfFileName));

            writeStream.once('finish', () => done());
            writeStream.once('error', done);

            doc.once('error', done);
        });
    }

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

    async downloadInvoice(invoiceId: string, res: Response) {
        const invoiceData = await this.userInvoiceRepository.findById(invoiceId);

        if (!invoiceData) {
            return res.status(404).send('Invoice not found');
        }

        // try {
        //     const pdfFilePath = await this.createPDF(invoiceData, {});
        //
        //     res.setHeader('Content-Type', 'application/pdf');
        //     res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoiceId}.pdf`);
        //
        //     const fileStream = fs.createReadStream(pdfFilePath);
        //
        //     fileStream.pipe(res);
        //
        //     fileStream.on('end', () => {
        //         fs.unlinkSync(pdfFilePath);
        //     });
        // } catch (error) {
        //     console.error('Error while generating or sending invoice:', error);
        //     res.status(500).send('An error occurred while downloading the invoice');
        // }
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
