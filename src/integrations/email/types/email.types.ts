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
  // Threading / reply-routing headers (used by the negotiation email chat).
  replyTo?: string;
  inReplyTo?: string;
  references?: string | string[];
  headers?: Record<string, string>;
  cc?: string | string[];
  bcc?: string | string[];
  messageId?: string;
};
