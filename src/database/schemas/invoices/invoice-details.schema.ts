import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";
import {Role} from "../../../common/types/user.types";

@Schema({
    timestamps: true,
})
export class InvoiceDetails {
    @Prop({type: Types.ObjectId})
    _id: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true})
    userId: Types.ObjectId;

    @Prop({type: String, required: true, enum: Role})
    userRole: Role

    @Prop({type: String, required: true})
    firstName: string;

    @Prop({type: String, required: true})
    lastName: string;

    @Prop({type: String, required: true})
    address: string;

    @Prop({type: String, required: true})
    country: string;

    @Prop({type: String, required: false})
    company: string;

    @Prop({type: String, required: false})
    vatNumber: string;
}

export const InvoiceDetailsSchema = SchemaFactory.createForClass(InvoiceDetails);
