import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types} from "mongoose";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {
    CampaignContentItem,
    CampaignContentItemSchema,
    SelectedContent,
    SelectedContentSchema
} from "./campaign.schema";

@Schema()
export class DraftCampaignAccount {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({required: true, type: Types.ObjectId, ref: 'Influencer'})
    influencerId: Types.ObjectId;

    @Prop({required: true, type: Types.ObjectId, ref: 'SocialAccount'})
    accountId: Types.ObjectId;

    @Prop({required: true, type: SelectedContentSchema})
    selectedContent: SelectedContent;
}

export const DraftCampaignAccountSchema = SchemaFactory.createForClass(DraftCampaignAccount);

@Schema({timestamps: true})
export class DraftCampaign {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: 'Client', required: true})
    clientId: Types.ObjectId;

    @Prop({type: [DraftCampaignAccountSchema], required: true})
    addedAccounts: DraftCampaignAccount[];

    @Prop({
        type: [CampaignContentItemSchema],
    })
    campaignContent: CampaignContentItem[];

    @Prop({type: String, required: true})
    campaignName: string;

    @Prop({type: String, required: true, enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    socialMedia: SocialMediaEnum | 'multipromo';

    createdAt: Date;
    updatedAt: Date;
}

export const DraftCampaignSchema = SchemaFactory.createForClass(DraftCampaign);