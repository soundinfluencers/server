import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import {HydratedDocument, Types} from 'mongoose';
import {
    InvoicePaymentMethodEnum,
    InvoiceStatusEnum,
} from '../../../common/types/invoice.types';
import {Role} from "../../../common/types/user.types";
import {
    InternationalBankTransferDetails,
    InternationalBankTransferDetailsSchema, PayPalDetails, PayPalDetailsSchema,
    UKBankTransferDetails,
    UKBankTransferDetailsSchema
} from "./payment-details.schema";
import {CampaignPaymentMethodEnum} from "../../../common/types/client/campaign.types";

export type UserInvoiceDocument = HydratedDocument<UserInvoice>;
export type ClientInvoiceDocument = HydratedDocument<UserInvoice & ClientInvoice>;
export type InfluencerInvoiceDocument = HydratedDocument<UserInvoice & InfluencerInvoice>;

// Subscheme for client invoice
@Schema({timestamps: true})
export class ClientInvoice {
    @Prop({ type: Types.ObjectId, required: false })
    campaignId: Types.ObjectId;

    @Prop({ type: String, required: false })
    campaignName: string;

    @Prop({ type: Number, required: false })
    campaignFollowers: number;

    @Prop({
        required: true,
        type: String,
        enum: CampaignPaymentMethodEnum,
    })
    selectedPaymentMethod: CampaignPaymentMethodEnum;

    @Prop({required: true, type: String})
    referenceNumber: string;

    @Prop({required: false, type: String})
    poNumber?: string;
}

export const ClientInvoiceSchema = SchemaFactory.createForClass(ClientInvoice);

// Subscheme for influencer invoice linked promos
@Schema({timestamps: true})
export class InfluencerInvoiceLinkedPromo {
    @Prop({required: true, type: Types.ObjectId})
    campaignId: Types.ObjectId;

    @Prop({required: true, type: Types.ObjectId})
    promoId: Types.ObjectId;

    @Prop({ required: true, type: Number })
    reward: number;
}

export const InfluencerInvoiceLinkedPromoSchema = SchemaFactory.createForClass(InfluencerInvoiceLinkedPromo);

// Subscheme for influencer invoice
@Schema({timestamps: true})
export class InfluencerInvoice {
    @Prop({ required: true, type: [InfluencerInvoiceLinkedPromoSchema], default: [] })
    linkedPromos: InfluencerInvoiceLinkedPromo[]; // list of closed promos that are waiting for payment

    @Prop({
        required: true,
        type: String,
        enum: InvoicePaymentMethodEnum,
    })
    selectedPaymentMethod: InvoicePaymentMethodEnum;
}

export const InfluencerInvoiceSchema = SchemaFactory.createForClass(InfluencerInvoice);

// Main scheme for invoices
@Schema({
    timestamps: true,
    discriminatorKey: 'userRole'
})
export class UserInvoice {
    @Prop({ type: Types.ObjectId, required: true })
    _id: Types.ObjectId;

    @Prop({ type: Number, default: 2, index: true, required: false })
    schemaVersion: number;

    @Prop({ type: Types.ObjectId, required: true })
    userId: Types.ObjectId;

    @Prop({ type: String, required: true, enum: Role })
    userRole: Role;

    @Prop({
        required: true,
        type: String,
        enum: InvoiceStatusEnum,
        default: InvoiceStatusEnum.submitted,
    })
    status: InvoiceStatusEnum;

    @Prop({ required: true, type: String })
    firstName: string;

    @Prop({ required: true, type: String })
    lastName: string;

    @Prop({ required: true, type: String })
    address: string;

    @Prop({ required: true, type: String })
    country: string;

    @Prop({ required: true, type: Number })
    amount: number;

    @Prop({ required: false, type: UKBankTransferDetailsSchema})
    ukBankTransfer?: UKBankTransferDetails;

    @Prop({
        required: false,
        type: InternationalBankTransferDetailsSchema,
    })
    internationalBankTransfer?: InternationalBankTransferDetails;

    @Prop({ required: false, type: PayPalDetailsSchema})
    paypal?: PayPalDetails;

    @Prop({ required: false, type: String, default: null })
    company?: string | null;

    @Prop({ required: false, type: String, default: null })
    vatNumber?: string | null;

    createdAt?: Date;
}

export const UserInvoiceSchema =
    SchemaFactory.createForClass(UserInvoice);
