import {PipelineStage, Types} from 'mongoose';
import {CreateInvoiceDto} from './dto/create-invoice.dto';
import {InfluencerInvoice} from '../../database/schemas/invoices/influencer-invoice.schema';
import {Injectable, NotFoundException} from '@nestjs/common';
import {Response} from 'express';
import sendMail from "../../integrations/nodemailer/nodemailer";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {InfluencerInvoiceRepository} from "../../database/repositories/invoices/influencer-invoice.repository";
import {GetInvoicesQueryDto} from "./dto/invoice.dto";
import {InvoiceForDashboard} from "../../common/types/influencer/invoice.types";

const fs = require('fs');
const PDFDocument = require('pdfkit');

@Injectable()
export class InvoiceService {
    constructor(
        private readonly influencerRepo: InfluencerRepository,
        private readonly influencerInvoiceRepository: InfluencerInvoiceRepository,
        private readonly influencerHistoryService: InfluencerActionsHistoryService
    ) {
    }

    async createPDF(result: any, data: Object) {
        function getFormattedDate() {
            const date = new Date();
            const day = date.getDate();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
        }

        function getPaymentMethod(): string {
            if (result.selectedPaymentMethod === 'Paypal') {
                return `Paypal Email: ${result.paypalEmail}`;
            } else if (result.selectedPaymentMethod.toLowerCase() === 'uk bank transfer') {
                return `Bank Name: ${result.bankName}\nBeneficiary: ${result.beneficiary}\nBeneficiary Address: ${result.beneficiaryAddress}\nSort Code: ${result.sortCode}\nAccount Number: ${result.accountNumber}`;
            } else if (result.selectedPaymentMethod.toLowerCase() === 'international bank transfer') {
                return `Bank Name: ${result.bankName}\nBeneficiary: ${result.beneficiary}\nBeneficiary Address: ${result.beneficiaryAddress}\nIBAN: ${result.iban}\nBank Country: ${result.bankCountry}\nBank Account Currency: ${result.bankAccountCurrency}\nSWIFT/BIC: ${result.swiftOrBic}`;
            }
            return '';
        }

        const pdfFileName = 'invoice.pdf';
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(pdfFileName);
        doc.pipe(writeStream);

        // Header
        doc.fontSize(20).text('INVOICE', 50, 50);

        // Sender's details
        doc.fontSize(10).text(result.contactName + ' ' + result.contactLastName, 50, 100);
        doc.text(result.street, 50, 115);
        doc.text(result.city + ', ' + result.country, 50, 130);
        doc.text(`Postcode: ${result.postcode}`, 50, 145);
        if (result.beneficiary) doc.text(result.beneficiary, 50, 160);

        // Date and Invoice Number
        doc.text(`DATE: ${getFormattedDate()}`, 400, 100);
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
        doc.text(result.beneficiary + ' campaign', 50, 350);
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
        doc.text(getPaymentMethod(), 50, currentY, {width: 500, continued: false});

        currentY = doc.y + 20;
        doc.text('Payment Terms: Within 7 business days', 50, currentY);

        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve('invoice.pdf'));
            writeStream.on('error', reject);
        });
    }

    async createInvoice(data: CreateInvoiceDto): Promise<void> {
        const influencer = await this.influencerRepo.findById(data.influencerId);

        if (!influencer) throw new NotFoundException('Influencer not found');

        const session = await this.influencerRepo.startSession();

        try {
            await session.startTransaction();

            // Creating invoice
            data.description = 'Payment Due: 7 days (subject to approval)';
            const result: InfluencerInvoice = await this.influencerInvoiceRepository.create({
                ...data,
                status: 'Submitted',
            });

            // Updating balance
            const newBalance = +influencer.balance - data.amount;
            await this.influencerRepo.findOneAndUpdate(
                {_id: new Types.ObjectId(data.influencerId)},
                {balance: newBalance},
            );

            // Updating influencer's actions history
            await this.influencerHistoryService.upsertInfluencerInvoiceHistory(
                {
                    influencerId: data.influencerId,
                    invoiceId: result._id.toString(),
                    paymentMethod: data.selectedPaymentMethod,
                    currentBalance: newBalance,
                    amount: data.amount,
                },
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
            await this.createPDF(result, data)
                .then(async (pdfPath) => {
                    await sendMail(
                        // "nazarkozynets030606@zohomail.eu",
                        // 'admin@soundinfluencers.com',
                        process.env.EMAIL_USER,
                        `${influencer.email}`,
                        `<p>Invoice from ${influencer.email} <b>(Contact email: ${data.contactEmail})</b> </p>
                    <p><b>ID:</b> ${result?._id}</p>
                    <p><b>Instagram Accounts:</b> ${instagramAccounts || '0 accounts'}</p>
                    <p><b>TikTok Accounts:</b> ${tiktokAccounts || '0 accounts'}</p>
                    <p><b>Spotify Accounts:</b> ${spotifyAccounts || '0 accounts'}</p>
                    <p><b>SoundCloud Accounts:</b> ${soundcloudAccounts || '0 accounts'}</p>
                    <p><b>Facebook Accounts:</b> ${facebookAccounts || '0 accounts'}</p>
                    <p><b>YouTube Accounts:</b> ${youtubeAccounts || '0 accounts'}</p>
                    <p><b>Press Accounts:</b> ${pressAccounts || '0 accounts'}</p>
                    <p><b>Selected Payment Method:</b> ${data.selectedPaymentMethod}</p>`,
                        'pdf',
                        pdfPath as string,
                    );

                    await sendMail(
                        data.contactEmail,
                        'soundinfluencers',
                        `<p>Hello</p>
                    <p>We acknowledge the receipt of your invoice. If everything is in order, we will process the payment to your details within the next 7 days.</p></br></br>
                    <p>Bests</br>Sound Influencers Team</p>`,

                        'html',
                    );
                })
                .catch((error) => {
                    console.error('Error creating PDF:', error);
                });

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
        const { limit, page, influencerId } = data;

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
                        $substr: [{ $toString: '$_id' }, 0, 8],
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

        try {
            const pdfFilePath = await this.createPDF(invoiceData, {});

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoiceId}.pdf`);

            const fileStream = fs.createReadStream(pdfFilePath);

            fileStream.pipe(res);

            fileStream.on('end', () => {
                fs.unlinkSync(pdfFilePath);
            });
        } catch (error) {
            console.error('Error while generating or sending invoice:', error);
            res.status(500).send('An error occurred while downloading the invoice');
        }
    }
}
