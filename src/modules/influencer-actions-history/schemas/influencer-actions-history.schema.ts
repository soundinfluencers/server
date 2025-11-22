import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Invoices } from '../../invoice/schemas/invoices.schema';

@Schema()
export class Action {
  @Prop({ type: Number, required: true })
  actionNumber: number;

  @Prop({ type: Number, required: false })
  rewardForInfluencer: number;

  @Prop({ type: String, required: true })
  networkUsername: string;

  @Prop({ type: String, required: false })
  socialMedia: string;

  @Prop({ type: Number, required: true })
  currentBalance: number;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: Boolean, required: false, default: true })
  isStillInCampaign: boolean;
}

export const ActionSchema = SchemaFactory.createForClass(Action);

@Schema()
export class Campaign {
  @Prop({ type: String, required: true })
  campaignId: string;

  @Prop({ type: String, required: true })
  campaignName: string;

  @Prop({ type: [ActionSchema], required: true })
  actions: Action[];
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);

@Schema()
export class Invoice {
  @Prop({ type: String, required: true })
  invoiceId: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: true })
  paymentMethod: string;

  @Prop({ type: Number, required: true })
  currentBalance: number;

  @Prop({ type: Date, required: true })
  date: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

@Schema({ timestamps: true })
export class InfluencerActionsHistory extends Document {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  influencerId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true })
  influencerEmail: string;

  @Prop({ required: true, type: [CampaignSchema], _id: false })
  campaigns: Campaign[];

  @Prop({ required: true, type: [InvoiceSchema], _id: false })
  invoices: Invoice[];
}

export const InfluencerActionsHistorySchema =
  SchemaFactory.createForClass(InfluencerActionsHistory);
