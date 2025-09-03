import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

interface typesInstagram {
  musicStyle: string;
  musicSubStyles: string[] | null;
  musicStyleOther: string[] | null;
  instagramUsername: string;
  instagramLink: string;
  followersNumber: string;
  logo: string;
  profileCategory: 'community' | 'creator';
  price: string;
  publicPrice: string;
  countries: { country: string; percentage: number }[] | null;
  categories: string[] | null;
  engagementRate: number | null;
  averageViews: number | null;
  creatorCategories: string[];
  isHidden: boolean;
  isDeleted: boolean;
  isVerified: boolean;
}

const typesInstagramApi = {
  musicStyle: String,
  musicSubStyles: [String] || null,
  musicStyleOther: [String] || null,
  instagramUsername: String,
  instagramLink: String,
  followersNumber: String,
  logo: String,
  profileCategory: {
    type: String,
    enum: ['community', 'creator'],
    default: 'community',
  },
  price: String,
  publicPrice: String,
  countries:
    [
      {
        country: String,
        percentage: Number,
      },
    ] || null,
  categories: [String] || null,
  engagementRate: Number || null,
  averageViews: Number || null,
  creatorCategories: {
    type: [String],
    required: false,
  },
  isHidden: Boolean,
  isDeleted: Boolean,
  isVerified: Boolean,
};

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

  @Prop({ type: [typesInstagramApi] })
  instagram: typesInstagram[];

  @Prop({ type: [typesInstagramApi] })
  tiktok: typesInstagram[];

  @Prop({ type: [typesInstagramApi] })
  spotify: typesInstagram[];

  @Prop({ type: [typesInstagramApi] })
  soundcloud: typesInstagram[];

  @Prop({ type: [typesInstagramApi] })
  facebook: typesInstagram[];

  @Prop({ type: [typesInstagramApi] })
  youtube: typesInstagram[];

  @Prop({ type: [typesInstagramApi] })
  press: typesInstagram[];

  @Prop()
  followersNumber: string;

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
}

export const InfluencerSchema = SchemaFactory.createForClass(Influencer);
