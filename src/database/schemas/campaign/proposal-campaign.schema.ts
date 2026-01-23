import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose, {Types} from 'mongoose';
import {
    CampaignAccount,
    CampaignContentItem,
    CampaignContentItemSchema,
} from "./campaign.schema";
import {Role} from "../../../common/types/auth.types";

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
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({ type: Number, default: 2, index: true, required: false })
    schemaVersion: number;

    @Prop({ required: false, type: Types.ObjectId })
    creatorId: Types.ObjectId;

    @Prop({ required: true, enum: Role, type: String })
    creatorRole: Role;

    @Prop({ required: true, default: 'instagram' })
    socialMedia: string;

    @Prop({ required: true })
    campaignName: string;

    @Prop({ required: true, type: Number })
    publicCampaignPrice: number; // show users

    @Prop({required: true, type: Number})
    privateCampaignPrice: number; // for us

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

    @Prop({ required: false, type: [String] })
    hiddenColumns?: string[];

    @Prop({ required: false, type: Boolean })
    isCpmAndResultHidden?: boolean;

    @Prop({ required: false, type: Boolean })
    isPriceHidden?: boolean;

    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}

export const ProposalCampaignSchema = SchemaFactory.createForClass(ProposalCampaign);
