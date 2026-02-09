import mongoose, {Document, Types} from 'mongoose';
import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {SocialMediaEnum} from "../../../common/types/social-media.types";

@Schema()
export class CampaignAction {
    @Prop({type: Types.ObjectId, required: true})
    addedAccountsId: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true})
    socialAccountId: Types.ObjectId;

    @Prop({type: Number, required: true, min: 0, max: 5})
    actionNumber: number;

    @Prop({type: Number, required: true})
    rewardForInfluencer: number;

    @Prop({type: String, required: true})
    networkUsername: string;

    @Prop({type: String, required: true, enum: SocialMediaEnum})
    socialMedia: SocialMediaEnum;

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
    @Prop({type: Types.ObjectId, required: true})
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
