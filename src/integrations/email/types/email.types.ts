export type EmailAttachment =
    | { filename: string; content: Buffer; contentType?: string }
    | { filename: string; path: string; contentType?: string };

export type EmailMessage = {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: EmailAttachment[];
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
};