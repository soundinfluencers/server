export type EmailAttachment = {
    filename: string;
    content?: Buffer;
    contentType?: string;
    path?: string;
    cid?: string;
};

export type EmailMessage = {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: EmailAttachment[];
};