import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";
import {Role} from "../../../common/types/auth.types";

@Schema({
    timestamps: true,
})
export class Client {
    @Prop()
    _id: Types.ObjectId;

    @Prop({required: true, type: String, enum: Role})
    role: Role;

    @Prop()
    firstName: string;

    @Prop()
    balance: number;

    @Prop()
    company: string;

    @Prop()
    companyType: string;

    @Prop()
    instagramUsername: string;

    @Prop({lowercase: true})
    email: string;

    @Prop()
    phone: string;

    @Prop()
    referalCode: string;

    @Prop()
    password: string;

    @Prop({default: 'wait'})
    statusVerify: string;

    @Prop()
    referenceNumber: string;

    @Prop({default: ''})
    logo: string;

    @Prop({default: false})
    isAdmin: boolean;

    @Prop({default: false})
    isProposalClient: boolean;

    @Prop({default: ''})
    internalNote: string;

    @Prop({default: null})
    refreshToken: string | null;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
