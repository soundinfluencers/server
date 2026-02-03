import {Injectable, InternalServerErrorException, Logger, ServiceUnavailableException} from "@nestjs/common";
import {buildRequestEditEmail} from "./templates/campaign-email.template";
import {BuildCampaignEmailDto} from "./dto/campaign-email.dto";
import sendMail from "../../integrations/nodemailer/nodemailer";
import {BuildInvoiceEmailDto} from "./dto/invoice-email.dto";
import {buildInfluencerInvoiceEmail, buildInfluencerInvoiceResponseEmail} from "./templates/invoice-email.template";

@Injectable()
export class EmailService {
    constructor() {}

    private readonly logger = new Logger("EmailService");

    // nodemailer error handler
    private async safeSend(...args: Parameters<typeof sendMail>) {
        try {
            return await sendMail(...args);
        } catch (err: any) {
            // this.logger.error('Email send failed', err);

            if (err?.code === 'EAUTH' || err?.responseCode === 535) {
                throw new ServiceUnavailableException('Email auth failed');
            }

            if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNECTION' || err?.code === 'ESOCKET') {
                throw new ServiceUnavailableException('Email service unavailable');
            }

            throw new InternalServerErrorException('Email failed');
        }
    }

    // Sends email to US about new campaign edit request
    async sendNewEditRequestEmail(data: BuildCampaignEmailDto) {
        const email = buildRequestEditEmail(data);
        return this.safeSend(
            'nazarkozynets030606@gmail.com',
            'Campaign edit request',
            email,
            'html',
            );
    };

    // Sends emails about new influencer invoice
    async sendNewInfluencerInvoiceEmail(data: BuildInvoiceEmailDto, pdfPath: string) {
        const emailToUs = buildInfluencerInvoiceEmail(data);
        const emailToInfluencer = buildInfluencerInvoiceResponseEmail();

        await this.safeSend(
            'nazarkozynets030606@gmail.com',
            `Invoice from ${data.influencerEmail}`,
            emailToUs,
            'pdf',
            pdfPath
        );

        this.safeSend(
            'nazarkozynets030606@gmail.com',
            `SoundInfluencers`,
            emailToInfluencer,
            'html',
        ).catch(err => {
            this.logger.warn('Influencer new invoice response email failed', err);
        });
    };
}