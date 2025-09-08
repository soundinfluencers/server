import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class SocialAccount {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId;

  @Prop() musicStyle: string;

  @Prop({ type: [String], default: [] })
  musicSubStyles: string[];

  @Prop({ type: [String], default: [] })
  musicStyleOther: string[];

  @Prop() instagramUsername: string;

  @Prop() instagramLink: string;

  @Prop() followersNumber: string;

  @Prop() logo: string;

  @Prop({
    type: String,
    enum: ['community', 'creator'],
    default: 'community',
  })
  profileCategory: 'community' | 'creator';

  @Prop() price: string;

  @Prop() publicPrice: string;

  @Prop({ type: String, default: null })
  currency: string | null;

  @Prop({ type: Number, default: 0 })
  initialPrice: number;

  @Prop({
    type: [
      {
        country: String,
        percentage: Number,
      },
    ],
    default: [],
  })
  countries: { country: string; percentage: number }[];

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ type: Number, default: null })
  engagementRate: number | null;

  @Prop({ type: Number, default: null })
  averageViews: number | null;

  @Prop({ type: [String], default: [] })
  creatorCategories: string[];

  @Prop({ default: false })
  isHidden: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: false })
  isVerified: boolean;
}

export const SocialAccountSchema = SchemaFactory.createForClass(SocialAccount);

@Schema({
  timestamps: true,
})
export class Influencer extends Document {
  @Prop({ default: 'influencer' })
  role: string;

  @Prop({ default: 0 })
  balance: string;

  @Prop()
  firstName: string;

  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop()
  password: string;

  @Prop({ default: 'wait' })
  statusVerify: string;

  @Prop({ default: '' })
  internalNote: string;

  @Prop({ default: '' })
  currencyNote: string;

  @Prop({ type: [SocialAccountSchema], default: [] })
  instagram: SocialAccount[];

  @Prop({ type: [SocialAccountSchema], default: [] })
  tiktok: SocialAccount[];

  @Prop({ type: [SocialAccountSchema], default: [] })
  spotify: SocialAccount[];

  @Prop({ type: [SocialAccountSchema], default: [] })
  soundcloud: SocialAccount[];

  @Prop({ type: [SocialAccountSchema], default: [] })
  facebook: SocialAccount[];

  @Prop({ type: [SocialAccountSchema], default: [] })
  youtube: SocialAccount[];

  @Prop({ type: [SocialAccountSchema], default: [] })
  press: SocialAccount[];
}

export const InfluencerSchema = SchemaFactory.createForClass(Influencer);
