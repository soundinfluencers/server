import mongoose, {Document, Types} from 'mongoose';
import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';

@Schema()
export class CampaignAction {
    @Prop({type: Number, required: true})
    actionNumber: number;

    @Prop({type: Number, required: false})
    rewardForInfluencer: number;

    @Prop({type: String, required: true})
    networkUsername: string;

    @Prop({type: String, required: false})
    socialMedia: string;

    @Prop({type: Number, required: true})
    currentBalance: number;

    @Prop({type: Date, required: true})
    date: Date;

    @Prop({type: Boolean, required: false, default: true})
    isStillInCampaign?: boolean;
}

export const CampaignActionSchema = SchemaFactory.createForClass(CampaignAction);

@Schema()
export class CampaignActionsHistory {
    @Prop({type: Types.ObjectId, required: true, ref: "Campaign"})
    campaignId: Types.ObjectId;

    @Prop({type: String, required: true})
    campaignName: string;

    @Prop({type: [CampaignActionSchema], required: true, default: []})
    actions: CampaignAction[];
}

export const CampaignActionsHistorySchema = SchemaFactory.createForClass(CampaignActionsHistory);

@Schema()
export class InvoiceAction {
    @Prop({type: Types.ObjectId, required: true, ref: "InfluencerInvoice"})
    invoiceId: Types.ObjectId;

    @Prop({type: Number, required: true})
    amount: number;

    @Prop({type: String, required: true})
    paymentMethod: string;

    @Prop({type: Number, required: true})
    currentBalance: number;

    @Prop({type: Date, required: true})
    date: Date;
}

export const InvoiceActionSchema = SchemaFactory.createForClass(InvoiceAction);

@Schema({timestamps: true})
export class InfluencerActionsHistory extends Document {
    @Prop({required: true, type: mongoose.Schema.Types.ObjectId})
    influencerId: mongoose.Schema.Types.ObjectId;

    @Prop({required: true})
    influencerEmail: string;

    @Prop({required: true, type: [CampaignActionsHistorySchema], default: []})
    campaigns: CampaignActionsHistory[];

    @Prop({required: true, type: [InvoiceActionSchema], default: []})
    invoices: InvoiceAction[];
}

export const InfluencerActionsHistorySchema = SchemaFactory.createForClass(InfluencerActionsHistory);
