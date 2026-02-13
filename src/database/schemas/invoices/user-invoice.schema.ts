import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
    InvoicePaymentMethodEnum,
    InvoiceStatusEnum,
} from '../../../common/types/influencer/invoice.types';
import {Role} from "../../../common/types/auth.types";
import {
    InternationalBankTransferDetails,
    InternationalBankTransferDetailsSchema, PayPalDetails, PayPalDetailsSchema,
    UKBankTransferDetails,
    UKBankTransferDetailsSchema
} from "./payment-details.schema";
import {CampaignPaymentMethodEnum} from "../../../common/types/client/campaign.types";

@Schema({
    timestamps: true,
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

    @Prop({ type: Types.ObjectId, required: false })
    campaignId?: Types.ObjectId; // only for client's invoice

    @Prop({ type: String, required: false })
    campaignName?: string; // only for client's invoice

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

    @Prop({
        required: true,
        type: String,
        enum: [
            ...Object.values(InvoicePaymentMethodEnum),
            ...Object.values(CampaignPaymentMethodEnum),
        ],
    })
    selectedPaymentMethod: InvoicePaymentMethodEnum | CampaignPaymentMethodEnum;

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
}

export const UserInvoiceSchema =
    SchemaFactory.createForClass(UserInvoice);
