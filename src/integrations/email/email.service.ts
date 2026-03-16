import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailMessage } from './types/email.types';

@Injectable()
export class EmailService {
    private readonly logger = new Logger('EmailService');
    private transporter: nodemailer.Transporter;

    constructor(private readonly config: ConfigService) {
        const user = this.config.get<string>('EMAIL_USER');
        const pass = this.config.get<string>('EMAIL_PASS');

        if (!user || !pass) {
            throw new Error('EMAIL_USER / EMAIL_PASS are missing');
        }

        this.transporter = nodemailer.createTransport({
            host: 'smtp.zoho.eu',
            port: 465,
            secure: true,
            auth: { user, pass },
        });
    }

    private async safeSend(message: EmailMessage) {
        try {
            const to =
                this.config.get('NODE_ENV') === 'development'
                    ? this.config.get<string>('EMAIL_USER')
                    : message.to;

            return await this.transporter.sendMail({
                from: `"SoundInfluencers" <${this.config.get<string>('EMAIL_USER')}>`,
                ...message,
                to,
            });
        } catch (err: any) {
            this.logger.error('Email send failed', err);

            if (err?.code === 'EAUTH' || err?.responseCode === 535) {
                throw new ServiceUnavailableException('Email auth failed');
            }
            if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNECTION' || err?.code === 'ESOCKET') {
                throw new ServiceUnavailableException('Email service unavailable');
            }
            throw new InternalServerErrorException('Email failed');
        }
    }

    async send(message: EmailMessage) {
        return this.safeSend(message);
    }
}