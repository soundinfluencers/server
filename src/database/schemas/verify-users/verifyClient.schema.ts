import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";

@Schema({
    timestamps: true,
})
export class VerifyClient {
    @Prop({type: Types.ObjectId, auto: true})
    _id?: Types.ObjectId;

    @Prop()
    clientId: string;
}

export const VerifyClientSchema = SchemaFactory.createForClass(VerifyClient);
