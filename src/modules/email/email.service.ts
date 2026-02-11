import {Injectable, InternalServerErrorException, Logger, ServiceUnavailableException} from "@nestjs/common";
import {
    buildClientCreatedCampaignTemplate, buildInfluencerNewPromoRequestTemplate, buildNewBespokeCampaignRequestTemplate,
    buildRequestEditTemplate
} from "./templates/campaign-email.template";
import {
    BuildClientCreatedCampaignTemplateDto,
    BuildInfluencerNewPromoRequestTemplateDto,
    BuildRequestEditTemplateDto
} from "./dto/campaign-email.dto";
import sendMail from "../../integrations/nodemailer/nodemailer";
import {BuildInvoiceEmailDto} from "./dto/invoice-email.dto";
import {
    buildClientCampaignInvoiceTemplate,
    buildInfluencerInvoiceEmail,
    buildInfluencerInvoiceResponseEmail
} from "./templates/invoice-email.template";
import {CreateBespokeCampaignDto} from "../campaigns/dto/bespoke-request.dto";

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
    async sendNewEditRequestEmail(data: BuildRequestEditTemplateDto) {
        const email = buildRequestEditTemplate(data);
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

    // Sends email to US about 'client created new campaign'
    async sendCampaignCreatedEmail(data: BuildClientCreatedCampaignTemplateDto) {
        const email = buildClientCreatedCampaignTemplate(data);
        return this.safeSend(
            'nazarkozynets030606@gmail.com',
            `Client created campaign`,
            email,
            'html',
        );
    };

    // Sends email to US about new bespoke campaign request
    async sendBespokeCampaignRequestEmail(
        data: CreateBespokeCampaignDto & {
            clientName?: string;
            clientEmail?: string;
        }
    ) {
        const email = buildNewBespokeCampaignRequestTemplate(data);
        return this.safeSend(
            'nazarkozynets030606@gmail.com',
            'Bespoke campaign request',
            email,
            'html'
        )
    }

    // Sends email to client with invoice (after creating new campaign)
    async sendClientCampaignInvoiceEmail(pdfPath: string) {
        const email = buildClientCampaignInvoiceTemplate();
        return this.safeSend(
            'nazarkozynets030606@gmail.com',
            'Campaign invoice',
            email,
            'pdf',
            pdfPath
        )
    }

    // Sends email to influencer about new promo request
    async sendInfluencerNewPromoRequestEmail(data: BuildInfluencerNewPromoRequestTemplateDto) {
        const email = buildInfluencerNewPromoRequestTemplate(data);
        return this.safeSend(
            'nazarkozynets030606@gmail.com',
            // data.email,
            'New promo request',
            email,
            'html'
        )
    }
}