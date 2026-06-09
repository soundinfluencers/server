import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {HydratedDocument, Types} from "mongoose";
import {RequestForAdminType} from "../../../common/types/request-for-admin/request-for-admin.types";
import {Role} from "../../../common/types/user.types";

export type NegotiationThreadDocument = HydratedDocument<NegotiationThread>;

@Schema({
    timestamps: true,
    collection: 'negotiation_threads',
})
export class NegotiationThread {
    @Prop({type: Types.ObjectId, auto: true})
    _id: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true})
    requestId: Types.ObjectId;

    @Prop({
        required: true,
        type: String,
        enum: Object.values(RequestForAdminType),
        immutable: true,
        index: true,
    })
    requestType: RequestForAdminType;

    @Prop({type: String, required: true, enum: ['ACTIVE', 'CLOSED']})
    status: 'ACTIVE' | 'CLOSED';

    @Prop({type: String, required: true})
    participantEmail: string;

    @Prop({type: String, required: true})
    participantName: string;

    @Prop({type: String, required: true})
    subject: string;

    @Prop({type: Date, required: true})
    lastMessageAt: Date;

    @Prop({type: Number, required: true})
    unreadForAdmin: number; // count of unread messages for admin

    @Prop({type: Types.ObjectId, required: true})
    createdById: Types.ObjectId; // _id of the user who created negotiation thread

    @Prop({type: String, required: true, enum: Role})
    createdByRole: Role; // role of the user who created negotiation thread

    createdAt: Date;
    updatedAt: Date;
}

export const NegotiationThreadSchema = SchemaFactory.createForClass(NegotiationThread);

NegotiationThreadSchema.index({requestId: 1, participantEmail: 1, status: 1});