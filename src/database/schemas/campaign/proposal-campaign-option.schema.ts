import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {CampaignAccount, CampaignContentItem, CampaignContentItemSchema} from "./campaign.schema";
import {Types} from "mongoose";
import {Role} from "../../../common/types/auth.types";

@Schema()
export class ProposalCampaignAccount extends CampaignAccount {
    @Prop({default: []})
    genres: string[];

    @Prop({default: []})
    countries: object[];
}

export const ProposalCampaignAccountSchema = SchemaFactory.createForClass(ProposalCampaignAccount);

@Schema({timestamps: true})
export class ProposalCampaignOption {
    @Prop({type: Types.ObjectId})
    _id: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'ProposalCampaign',
        required: true
    })
    proposalCampaignId: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId })
    creatorId: Types.ObjectId;

    @Prop({ required: true, enum: Role, type: String })
    creatorRole: Role;

    @Prop({ type: Number, default: 1, index: true, required: false })
    schemaVersion: number;

    @Prop({ required: true, type: Number })
    publicCampaignPrice: number; // show users

    @Prop({required: true, type: Number})
    privateCampaignPrice: number; // for us

    @Prop({
        type: [ProposalCampaignAccountSchema],
        required: true,
        default: []
    })
    addedAccounts: ProposalCampaignAccount[];

    @Prop({
        required: true,
        type: [CampaignContentItemSchema],
        default: []
    })
    campaignContent: CampaignContentItem[];
}

export const ProposalCampaignOptionSchema = SchemaFactory.createForClass(ProposalCampaignOption);

ProposalCampaignOptionSchema.index({ proposalCampaignId: 1 });
ProposalCampaignOptionSchema.index({ proposalCampaignId: 1, createdAt: -1 });
ProposalCampaignOptionSchema.index({ proposalCampaignId: 1, createdAt: 1 });
ProposalCampaignOptionSchema.index({ proposalCampaignId: 1, updatedAt: -1 });
ProposalCampaignOptionSchema.index({ proposalCampaignId: 1, updatedAt: 1 });
