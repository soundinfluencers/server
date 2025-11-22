import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import {
  CampaignContentItem,
  CampaignContentItemSchema,
  SelectedContent,
  SelectedContentSchema
} from "../../promos/schemas/promo.schema";

@Schema()
export class SelectInfluencers {
  @Prop()
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Influencer' })
  influencerId: mongoose.Schema.Types.ObjectId;

  @Prop()
  socialMedia: string;

  @Prop()
  socialMediaUsername: string;

  @Prop()
  confirmation: string;

  @Prop({ default: '0' })
  price: string;

  @Prop({ default: '0' })
  publicPrice: string;

  @Prop({ type: SelectedContentSchema })
  selectedContent: SelectedContent;

  @Prop()
  dateRequest: string;

  @Prop({ default: 'wait' })
  closePromo: string;

  @Prop({ default: '' })
  postLink: string;

  @Prop({ default: '' })
  screenshot: string;

  @Prop({ default: '' })
  impressions: string;

  @Prop({ default: '' })
  like: string;

  @Prop({ default: 0 })
  followersNumber: number;

  @Prop({ default: [] })
  genres: string[];

  @Prop({ default: [] })
  countries: object[];
}
export const SelectInfluencersSchema = SchemaFactory.createForClass(SelectInfluencers);

@Schema({ timestamps: true })
export class ProposalCampaign {
  @Prop({ required: false, type: mongoose.Schema.Types.ObjectId, ref: 'Client' })
  clientId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true })
  campaignName: string;

  @Prop({
    required: false,
    type: [SelectInfluencersSchema],
    default: [],
  })
  selectInfluencers: SelectInfluencers[];

  @Prop({
    required: false,
    type: [CampaignContentItemSchema],
    default: [],
  })
  campaignContent: CampaignContentItem[];

  @Prop({ required: false, default: 0 })
  price: number;

  @Prop({ required: false, default: 0 })
  publicPrice: number;

  @Prop({ required: false, default: 0 })
  totalFollowers: number;

  @Prop({ required: true, default: 'instagram' })
  socialMedia: string;

  @Prop({ required: false, default: false })
  isPriceHidden: boolean;

  @Prop({ required: false, default: false })
  isCpmAndResultHidden: boolean;

  @Prop({ required: false, default: [] })
  hiddenColumns: string[];

  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export const ProposalCampaignSchema = SchemaFactory.createForClass(ProposalCampaign);
