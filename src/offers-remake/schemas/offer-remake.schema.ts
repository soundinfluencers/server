import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SocialMediaEnum, SocialMediaType } from '../../types/social-media.types';
import {
  OfferConnectedAccount,
  OfferConnectedAccountSchema,
} from '../entities/offer-connected-account.entity';

@Schema({
  timestamps: true,
})
export class OfferRemake {
  @Prop({ required: true })
  title: string;

  @Prop({
    required: true,
    type: String,
    enum: SocialMediaEnum,
  })
  socialMedia: SocialMediaType;

  @Prop({
    required: true,
    type: [OfferConnectedAccountSchema],
  })
  connectedAccounts: OfferConnectedAccount[];

  @Prop({
    required: true,
  })
  price: number;

  @Prop({
    type: String,
    enum: [
      'Techno (Melodic, Minimal)',
      'Techno (Hard, Peak)',
      'House (Tech House)',
      'House (Melodic, Afro)',
      'EDM',
      'D&B',
      'Bass',
      'Psy, Trance',
      'Dubstep',
      'Garage',
      'Dance Pop',
    ],
    default: null,
    required: false,
  })
  genre?: string | null;

  @Prop({ required: false, default: null })
  combinedFollowers?: number | null;

  @Prop({ required: false, default: null })
  networksAmount?: string | null;

  @Prop({ required: false, default: null })
  storyAndPostDetails?: string | null;

  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId;

  @Prop()
  readonly createdAt?: Date;

  @Prop()
  readonly updatedAt?: Date;
}

export const OfferRemakeSchema = SchemaFactory.createForClass(OfferRemake);
