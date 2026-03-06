import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {HydratedDocument, Types} from "mongoose";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {
    CampaignContentItem,
    CampaignContentItemSchema,
    SelectedContent,
    SelectedContentSchema
} from "./campaign.schema";
import {CampaignDraftLatestStep} from "../../../common/types/client/campaign.types";

export type DraftCampaignAccountDocument = HydratedDocument<DraftCampaignAccount>;

@Schema()
export class DraftCampaignAccount { // don't save fields social account info (followers, logo, etc) cause need to aggregate them in case if some fields were changed
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({required: true, type: Types.ObjectId, ref: 'Influencer'})
    influencerId: Types.ObjectId;

    @Prop({required: true, type: Types.ObjectId, ref: 'SocialAccount'})
    accountId: Types.ObjectId;

    @Prop({type: String, required: true, enum: [...Object.values(SocialMediaEnum)]})
    socialMedia: SocialMediaEnum;

    @Prop({required: false, type: SelectedContentSchema})
    selectedContent?: SelectedContent;
}

export const DraftCampaignAccountSchema = SchemaFactory.createForClass(DraftCampaignAccount);

export type DraftCampaignDocument = HydratedDocument<DraftCampaign>;

@Schema({timestamps: true})
export class DraftCampaign {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: 'Client', required: true})
    clientId: Types.ObjectId;

    @Prop({required: true, default: CampaignDraftLatestStep.addAccounts, enum: CampaignDraftLatestStep, type: String})
    latestStep: CampaignDraftLatestStep;

    @Prop({type: [DraftCampaignAccountSchema], required: true})
    addedAccounts: DraftCampaignAccount[]; // for showing selected accounts

    @Prop({type: String, required: true, enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    socialMedia: SocialMediaEnum | 'multipromo';

    // UNREQUIRED FIELDS

    @Prop({type: Types.ObjectId, required: false})
    selectedOffer?: Types.ObjectId; // for showing selected offer

    @Prop({type: String, required: false})
    campaignName?: string;

    @Prop({
        required: false,
        type: [CampaignContentItemSchema],
    })
    campaignContent?: CampaignContentItem[];

    // TIMESTAMPS

    createdAt?: Date;
    updatedAt?: Date;
}

export const DraftCampaignSchema = SchemaFactory.createForClass(DraftCampaign);