import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types} from "mongoose";

@Schema({_id: false, timestamps: false})
class NegotiationMessageAttachment {
    @Prop({type: String, required: true})
    filename: string;

    @Prop({type: String, required: true})
    mimeType: string;

    @Prop({type: Number, required: true})
    size: number;

    @Prop({type: String, required: true})
    storageKey: string;
}

export const NegotiationMessageAttachmentSchema =
    SchemaFactory.createForClass(NegotiationMessageAttachment);

@Schema({
    timestamps: true,
    collection: 'negotiation_messages',
})
export class NegotiationMessage {
    @Prop({type: Types.ObjectId, auto: true})
    _id: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true})
    threadId: Types.ObjectId;

    @Prop({type: String, required: true, enum: ['INBOUND', 'OUTBOUND']})
    direction: 'INBOUND' | 'OUTBOUND';

    @Prop({type: String, required: true})
    fromEmail: string;

    @Prop({type: String, required: true})
    toEmail: string;

    @Prop({type: String, required: false})
    authorAdminId?: Types.ObjectId;

    @Prop({type: String, required: true})
    subject: string;

    @Prop({type: String, required: true})
    bodyHtml: string;

    @Prop({type: [NegotiationMessageAttachmentSchema], required: false})
    attachments?: NegotiationMessageAttachment[];

    @Prop({type: Types.ObjectId, required: true, unique: true})
    messageId: Types.ObjectId; // id of message, unique

    @Prop({type: Types.ObjectId, required: true})
    inReplyTo: Types.ObjectId; // id of message, which this message is replying to

    @Prop({type: String, required: true, enum: ['QUEUED', 'SENT', 'FAILED']})
    deliveryStatus: 'QUEUED' | 'SENT' | 'FAILED';
}

export const NegotiationMessageSchema =
    SchemaFactory.createForClass(NegotiationMessage);

NegotiationMessageSchema.pre('validate', function (next) {
    if (this.direction === 'OUTBOUND' && !this.authorAdminId) {
        this.invalidate(
            'authorAdminId',
            'authorAdminId is required when direction is OUTBOUND',
        );
    }

    if (this.direction === 'INBOUND' && this.authorAdminId) {
        this.invalidate(
            'authorAdminId',
            'authorAdminId must not be provided when direction is INBOUND',
        );
    }

    next();
});