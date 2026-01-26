import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
    InvoicePaymentMethodEnum,
    InvoiceStatusEnum,
} from '../../../common/types/influencer/invoice.types';

// ------------- SUB SCHEMAS -------------


@Schema({ _id: false })
export class UKBankTransferDetails {
    @Prop({ required: true, type: String })
    beneficiary: string;

    @Prop({ required: true, type: String })
    beneficiaryAddress: string;

    @Prop({ required: true, type: String })
    sortCode: string;

    @Prop({ required: true, type: String })
    accountNumber: string;
}

export const UKBankTransferDetailsSchema =
    SchemaFactory.createForClass(UKBankTransferDetails);

@Schema({ _id: false })
export class InternationalBankTransferDetails {
    @Prop({ required: true, type: String })
    beneficiary: string;

    @Prop({ required: true, type: String })
    beneficiaryAddress: string;

    @Prop({ required: true, type: String })
    iban: string;

    @Prop({ required: true, type: String })
    bankName: string;

    @Prop({ required: true, type: String })
    bankCountry: string;

    @Prop({ required: true, type: String })
    bankAccountCurrency: string;

    @Prop({ required: true, type: String })
    swiftBicCode: string;
}

export const InternationalBankTransferDetailsSchema =
    SchemaFactory.createForClass(InternationalBankTransferDetails);

@Schema({ _id: false })
export class PayPalDetails {
    @Prop({ required: false, type: String })
    paypalEmail?: string;
}

export const PayPalDetailsSchema = SchemaFactory.createForClass(PayPalDetails);


// ------------- MAIN SCHEMA -------------


@Schema({
    timestamps: true,
})
export class InfluencerInvoice {
    @Prop({ type: Types.ObjectId, required: true })
    _id: Types.ObjectId;

    @Prop({ type: Number, default: 2, index: true, required: false })
    schemaVersion: number;

    @Prop({ type: Types.ObjectId, required: true, ref: 'Influencer' })
    influencerId: Types.ObjectId;

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
        enum: InvoicePaymentMethodEnum,
    })
    selectedPaymentMethod: InvoicePaymentMethodEnum;

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

export const InfluencerInvoiceSchema =
    SchemaFactory.createForClass(InfluencerInvoice);
