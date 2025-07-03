import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema()
export class OfferConnectedAccount {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Influencer',
  })
  influencerId: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
  })
  accountId: Types.ObjectId;
}

export const OfferConnectedAccountSchema = SchemaFactory.createForClass(OfferConnectedAccount);
