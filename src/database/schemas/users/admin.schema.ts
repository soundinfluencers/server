import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";
import {Role} from "../../../common/types/auth.types";

@Schema({
    timestamps: true,
})
export class Admin {
    @Prop({ type: Types.ObjectId })
    _id: Types.ObjectId;

    @Prop({required: true, type: String, enum: Role})
    role: Role;

    @Prop()
    firstName: string;

    @Prop({lowercase: true})
    email: string;

    @Prop()
    password: string;

    @Prop({default: 'wait'})
    statusVerify: string;

    @Prop({default: null})
    refreshToken: string | null;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

// Indexes for admin schema
AdminSchema.index({ email: 1 }, { unique: true, background: true });