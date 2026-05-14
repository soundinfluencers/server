import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";
import {AccountVerifiedStatus, Role} from "../../../common/types/user.types";

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

    @Prop({required: false, type: String})
    lastName?: string;

    @Prop({required: false, type: String})
    logoUrl?: string;

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

    @Prop()
    referenceNumber: string;

    @Prop({default: ''})
    logo: string;

    @Prop({default: false})
    isProposalClient: boolean;

    @Prop({required: false, default: AccountVerifiedStatus.waitForAdmin, enum: AccountVerifiedStatus, type: String})
    verifiedStatus?: AccountVerifiedStatus;

    @Prop({default: ''})
    internalNote: string;

    @Prop({default: null})
    refreshToken: string | null;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
