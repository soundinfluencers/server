import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {ObjId} from "../../../common/types/base.types";
import {HydratedDocument} from "mongoose";
import {CurrencyCode} from "../../../common/types/finance.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

export type NegotiationOfferDocument = HydratedDocument<NegotiationOffer>;
export type NegotiationDocument = HydratedDocument<Negotiation>;

// Schema for social account that became reason for negotiation
@Schema({ _id: false })
export class DisputedAccount {
    @Prop({ required: true, type: ObjId })
    accountId: ObjId;

    @Prop({ required: true, enum: SocialMediaEnum, type: String })
    socialMedia: SocialMediaEnum;
}
export const NegotiationDisputedAccountSchema = SchemaFactory.createForClass(DisputedAccount);

@Schema({timestamps: true})
export class NegotiationOffer {
    @Prop({ required: true, type: ObjId })
    _id: ObjId;

    @Prop({ required: true, type: ObjId, ref: 'Negotiation'})
    negotiationId: ObjId;

    @Prop({ required: true, type: Number })
    offeredPrice: number;

    @Prop({ required: true, enum: CurrencyCode, type: String })
    currency: CurrencyCode;

    @Prop({required: true, type: String})
    email: string;

    createdAt?: Date;
    updatedAt?: Date;
}

@Schema({timestamps: true})
export class Negotiation {
    @Prop({ required: true, type: ObjId })
    _id: ObjId;

    @Prop({ required: true, type: ObjId })
    userId: ObjId;

    @Prop({ required: true, type: NegotiationDisputedAccountSchema })
    disputedAccount: DisputedAccount;

    @Prop({ type: [{ type: ObjId, ref: 'NegotiationOffer' }], default: [] })
    offersToAdmin: ObjId[];

    @Prop({ type: [{ type: ObjId, ref: 'NegotiationOffer' }], default: [] })
    offersToUser: ObjId[];

    createdAt?: Date;
    updatedAt?: Date;
}

export const NegotiationOfferSchema = SchemaFactory.createForClass(NegotiationOffer);
export const NegotiationSchema = SchemaFactory.createForClass(Negotiation);

NegotiationOfferSchema.index({ negotiationId: 1, sentAt: -1 });
NegotiationSchema.index({ userId: 1, userRole: 1 });
NegotiationSchema.index({ "disputedAccount.accountId": 1, userId: 1 });