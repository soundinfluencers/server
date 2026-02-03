import {PipelineStage, Types} from 'mongoose';
import {CreateInvoiceDto} from './dto/create-invoice.dto';
import {InfluencerInvoice} from '../../database/schemas/invoices/influencer-invoice.schema';
import {BadRequestException, ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {Response} from 'express';
import sendMail from "../../integrations/nodemailer/nodemailer";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {InfluencerInvoiceRepository} from "../../database/repositories/invoices/influencer-invoice.repository";
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
import {Role} from "../../common/types/auth.types";

const fs = require('fs');
const PDFDocument = require('pdfkit');

@Injectable()
export class InvoiceService {
    constructor(
        private readonly influencerRepo: InfluencerRepository,
        private readonly clientRepo: ClientRepository,
        private readonly influencerInvoiceRepository: InfluencerInvoiceRepository,
        private readonly invoiceDetailsRepo: InvoiceDetailsRepository,
        private readonly influencerHistoryService: InfluencerActionsHistoryService,
        private readonly emailService: EmailService
    ) {
    }

    private async createPDF(result: InfluencerInvoice) {
        let beneficiary, beneficiaryAddress, paymentMethodDetails;

        switch (result.selectedPaymentMethod) {
            case InvoicePaymentMethodEnum.internationalBankTransfer:
                beneficiary = result?.internationalBankTransfer?.beneficiary;
                beneficiaryAddress = result?.internationalBankTransfer?.beneficiaryAddress;
                paymentMethodDetails = `Bank Name: ${result?.internationalBankTransfer?.bankName}\nBeneficiary: ${result?.internationalBankTransfer?.beneficiary}\nBeneficiary Address: ${result?.internationalBankTransfer?.beneficiaryAddress}\nIBAN: ${result?.internationalBankTransfer?.iban}\nBank Country: ${result?.internationalBankTransfer?.bankCountry}\nBank Account Currency: ${result?.internationalBankTransfer?.bankAccountCurrency}\nSWIFT/BIC: ${result?.internationalBankTransfer?.swiftBicCode}`;
                break;
            case InvoicePaymentMethodEnum.ukBankTransfer:
                beneficiary = result?.ukBankTransfer?.beneficiary;
                beneficiaryAddress = result?.ukBankTransfer?.beneficiaryAddress;
                paymentMethodDetails = `Beneficiary: ${result?.ukBankTransfer?.beneficiary}\nBeneficiary Address: ${result?.ukBankTransfer?.beneficiaryAddress}\nSort Code: ${result?.ukBankTransfer?.sortCode}\nAccount Number: ${result?.ukBankTransfer?.accountNumber}`;
                break;
            case InvoicePaymentMethodEnum.paypal:
                beneficiary = `${result.firstName} ${result.lastName}`;
                beneficiaryAddress = undefined;
                paymentMethodDetails = `Paypal Email: ${result?.paypal?.paypalEmail}`;
                break;
            default:
                throw new BadRequestException(`Unsupported payment method: ${String(result.selectedPaymentMethod)}`);
        }


        const pdfFileName = 'invoice.pdf';
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(pdfFileName);
        doc.pipe(writeStream);

        // Header
        doc.fontSize(20).text('INVOICE', 50, 50);

        // Sender's details
        doc.fontSize(10).text(result.firstName + ' ' + result.lastName, 50, 100);
        doc.text(result.address, 50, 115);
        doc.text(`Postcode: ${result.country}`, 50, 130);
        doc.text(beneficiary, 50, 145);
        if (beneficiaryAddress) doc.text(beneficiaryAddress, 50, 160);

        // Date and Invoice Number
        doc.text(`DATE: ${formatDate(new Date())}`, 400, 100);
        doc.text(`INVOICE NO. ${result?._id}`, 400, 115);

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
        doc.text(result.amount + '€', 250, 350);

        // Payment details
        let currentY = 400;
        doc.text('SUBTOTAL:', 50, currentY);
        doc.text(result.amount + '€', 250, currentY);

        currentY += 15;
        doc.text('BALANCE DUE:', 50, currentY);
        doc.text(result.amount + '€', 250, currentY);

        currentY += 20;
        doc.text('Selected Payment Method: ' + result.selectedPaymentMethod, 50, currentY);

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

    async createInvoice(data: CreateInvoiceDto): Promise<void> {
        const influencer = await this.influencerRepo.findById(data.influencerId);

        if (!influencer) throw new NotFoundException('Influencer not found');

        const session = await this.influencerRepo.startSession();
        session.startTransaction();

        try {
            const amount = Number(data.amount);

            const updatedInfluencer = await this.influencerRepo.findOneAndUpdate(
                {
                    _id: new Types.ObjectId(data.influencerId),
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
            const invoice = await this.influencerInvoiceRepository.create({
                _id: new Types.ObjectId(),
                schemaVersion: 2,
                influencerId: influencer._id,
                status: InvoiceStatusEnum.submitted,
                firstName: data.firstName,
                lastName: data.lastName,
                address: data.address,
                country: data.country,
                amount: data.amount,
                selectedPaymentMethod: data.selectedPaymentMethod,

                ...(data.ukBankTransfer ? {ukBankTransfer: data.ukBankTransfer} : {}),
                ...(data.internationalBankTransfer ? {internationalBankTransfer: data.internationalBankTransfer} : {}),
                ...(data.paypal ? {paypal: data.paypal} : {}),
                ...(data.company ? {company: data.company} : {}),
                ...(data.vatNumber ? {vatNumber: data.vatNumber} : {}),
            } satisfies InfluencerInvoice, {session});

            // Updating influencer's actions history
            await this.influencerHistoryService.upsertInfluencerInvoiceHistory(
                {
                    influencerId: data.influencerId,
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
            const pdfInvoice = await this.createPDF(invoice)
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
            session.endSession();
        }
    }

    async getInvoices(
        data: GetInvoicesQueryDto,
    ): Promise<InvoiceForDashboard[]> {
        const {limit, page, influencerId} = data;

        const skip = (page - 1) * limit;

        const pipeline: PipelineStage[] = [
            {
                $match: {
                    influencerId: new Types.ObjectId(influencerId),
                },
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $skip: skip,
            },
            {
                $limit: limit,
            },
            {
                $project: {
                    _id: 0,
                    shortInvoiceId: {
                        $substr: [{$toString: '$_id'}, 0, 8],
                    },
                    creationDate: {
                        $dateToString: {
                            date: '$createdAt',
                            format: '%d.%m.%Y',
                        },
                    },
                    paymentMethod: '$selectedPaymentMethod',
                    amount: 1,
                    status: 1,
                },
            },
        ];

        return this.influencerInvoiceRepository.aggregate(pipeline);
    }

    async downloadInvoice(invoiceId: string, res: Response) {
        const invoiceData = await this.influencerInvoiceRepository.findById(invoiceId);

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

    async getInvoiceDraft(influencerId: string): Promise<CreateInvoiceDto> {
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

        const latestInvoice = await this.influencerInvoiceRepository.findOne({
            influencerId: new Types.ObjectId(influencerId)
        }, {
            lean: true,
            sort: ({ createdAt: -1 })
        })

        return {
            firstName: invoiceDetails.firstName ?? latestInvoice.firstName ?? null,
            lastName: invoiceDetails.lastName ?? latestInvoice.lastName ?? null,
            address: invoiceDetails.address ?? latestInvoice.address ?? null,
            country: invoiceDetails.country ?? latestInvoice.country ?? null,
            company: invoiceDetails.company ?? latestInvoice.company ?? null,
            vatNumber: invoiceDetails.vatNumber ?? latestInvoice.vatNumber ?? null,
            amount: influencerBalance.balance,
            selectedPaymentMethod: latestInvoice.selectedPaymentMethod ?? null,
            ukBankTransfer: latestInvoice.ukBankTransfer ?? null,
            internationalBankTransfer: latestInvoice.internationalBankTransfer ?? null,
            paypal: latestInvoice.paypal ?? null
        }
    }
}
