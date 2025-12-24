import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";

@Schema({
    timestamps: true,
})
export class VerifyClient {
    @Prop({ type: Types.ObjectId, auto: true })
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
    clientId: Types.ObjectId;
}

export const VerifyClientSchema = SchemaFactory.createForClass(VerifyClient);
