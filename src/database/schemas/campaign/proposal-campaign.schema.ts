import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import {
    CampaignAccount,
    CampaignContentItem,
    CampaignContentItemSchema,
} from "./campaign.schema";

@Schema()
export class CampaignAccountForProposal extends CampaignAccount {
    @Prop({ default: [] })
    genres: string[];

    @Prop({ default: [] })
    countries: object[];
}
export const SelectInfluencersForProposalSchema = SchemaFactory.createForClass(CampaignAccountForProposal);

@Schema({ timestamps: true })
export class ProposalCampaign {
    @Prop({ required: false, type: mongoose.Schema.Types.ObjectId })
    clientId: mongoose.Schema.Types.ObjectId;

    @Prop({ required: true })
    campaignName: string;

    @Prop({
        required: false,
        type: [SelectInfluencersForProposalSchema],
        default: [],
    })
    addedAccounts: CampaignAccountForProposal[];

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
