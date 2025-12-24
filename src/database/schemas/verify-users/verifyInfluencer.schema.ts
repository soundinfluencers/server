import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";

@Schema({
    timestamps: true,
})
export class VerifyInfluencer {
    @Prop({ type: Types.ObjectId, auto: true })
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Influencer', required: true })
    influencerId: Types.ObjectId;
}

export const VerifyInfluencerSchema = SchemaFactory.createForClass(VerifyInfluencer);
