import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";
import {Role} from "../../../common/types/user.types";

@Schema({
    timestamps: true,
})
export class Forgot {
    @Prop({required: true, type: Types.ObjectId})
    _id: Types.ObjectId;

    @Prop({required: true, type: Types.ObjectId})
    userId: Types.ObjectId;

    @Prop({required: true, type: String, enum: Role})
    userRole: Role;

    @Prop({required: true, type: String})
    tokenHash: string;

    createdAt: Date;
}

export const ForgotSchema = SchemaFactory.createForClass(Forgot);

ForgotSchema.index({createdAt: 1}, {expireAfterSeconds: 900});
ForgotSchema.index({ userId: 1, userRole: 1 }, { unique: true });