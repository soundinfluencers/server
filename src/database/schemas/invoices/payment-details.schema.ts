import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types} from "mongoose";
import {Role} from "../../../common/types/user.types";

@Schema({ timestamps: true })
export class UKBankTransferDetails {
    @Prop({ type: Types.ObjectId, required: true })
    _id: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId })
    userId: Types.ObjectId;

    @Prop({ required: true, type: String, enum: Role })
    userRole: Role;

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

@Schema({ timestamps: true })
export class InternationalBankTransferDetails {
    @Prop({ type: Types.ObjectId, required: true })
    _id: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId })
    userId: Types.ObjectId;

    @Prop({ required: true, type: String, enum: Role })
    userRole: Role;

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

@Schema({ timestamps: true })
export class PayPalDetails {
    @Prop({ type: Types.ObjectId, required: true })
    _id: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId })
    userId: Types.ObjectId;

    @Prop({ required: true, type: String, enum: Role })
    userRole: Role;

    @Prop({ required: true, type: String })
    paypalEmail?: string;
}

export const PayPalDetailsSchema = SchemaFactory.createForClass(PayPalDetails);