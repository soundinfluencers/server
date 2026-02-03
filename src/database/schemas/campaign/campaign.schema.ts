import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from 'mongoose';
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {
    CampaignConfirmationEnum,
    CampaignPaymentMethodEnum, CampaignPaymentStatusEnum,
    CampaignStatusEnum
} from "../../../common/types/client/campaign.types";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../../common/types/influencer/promo.types";

@Schema({_id: false, timestamps: false})
export class SelectedContent {
    @Prop({type: Types.ObjectId, required: true})
    campaignContentItemId: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: false})
    descriptionId?: Types.ObjectId;
}

export const SelectedContentSchema = SchemaFactory.createForClass(SelectedContent);

@Schema({timestamps: true})
export class CampaignAccount {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true, ref: "Influencer"})
    influencerId: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true, default: null, ref: "SocialAccount"})
    accountId: Types.ObjectId | null;

    @Prop({required: true, enum: SocialMediaEnum})
    socialMedia: SocialMediaEnum;

    @Prop({required: true, type: String})
    username: string; // was socialMediaUsername

    @Prop({required: true, type: Number})
    price: number; // saving account's price cause after closing campaign if account will increase price, we need to show the old one

    @Prop({required: true, type: Number})
    publicPrice: number; // saving account's publicPrice cause after closing campaign if account will increase publicPrice, we need to show the old one

    @Prop({required: true, type: Number})
    followers: number; // saving account's followers amount cause after closing campaign if account will grow, we need to show the old one

    @Prop({type: SelectedContentSchema, required: true})
    selectedContent: SelectedContent;

    @Prop({required: true, type: String, enum: InfluencerConfirmationStatusEnum, default: 'wait'})
    confirmation: InfluencerConfirmationStatusEnum;

    @Prop({required: true, type: String, enum: InfluencerPromoClosedStatusEnum, default: 'wait'})
    closePromo: InfluencerPromoClosedStatusEnum;

    @Prop({required: false, type: String})
    dateRequest?: string;

    @Prop({type: String, required: false})
    datePost?: string;

    @Prop({type: String, required: false})
    postLink?: string;

    @Prop({type: String, required: false})
    screenshot?: string;

    @Prop({type: Number, required: false})
    impressions?: number;

    @Prop({type: Number, required: false})
    like?: number;

    @Prop({type: Number, required: false})
    comments?: number;

    @Prop({type: Number, required: false})
    shares?: number;

    @Prop({type: Number, required: false})
    saves?: number;

    @Prop({type: Number, required: false})
    rating?: number;

    @Prop({type: Boolean, required: false})
    adminChecked?: boolean;

    createdAt?: Date;
    updatedAt?: Date;
}

const CampaignAccountSchema = SchemaFactory.createForClass(CampaignAccount);

@Schema({timestamps: false})
export class CampaignContentDescriptionItem {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({type: String, required: true})
    description: string;
}

export const CampaignContentDescriptionItemSchema = SchemaFactory.createForClass(CampaignContentDescriptionItem);

@Schema()
export class CampaignContentItem {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({required: true, enum: SocialMediaEnum})
    socialMedia: SocialMediaEnum;

    @Prop({required: true, type: String, default: 'main'})
    socialMediaGroup: string;

    @Prop({type: String, required: true})
    mainLink: string; // was videoLink

    @Prop({type: [CampaignContentDescriptionItemSchema], required: false})
    descriptions?: CampaignContentDescriptionItem[]; // was postDescriptions

    @Prop({required: false, type: String})
    taggedUser?: string;

    @Prop({required: false, type: String})
    taggedLink?: string; // was swipeUpLink

    @Prop({required: false, type: String})
    additionalBrief?: string; // was specialWishes
}

export const CampaignContentItemSchema = SchemaFactory.createForClass(CampaignContentItem);

@Schema({timestamps: true})
export class Campaign {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({ type: Number, default: 2, index: true, required: false })
    schemaVersion: number;

    @Prop({type: Types.ObjectId, ref: 'Client', required: true})
    clientId: Types.ObjectId;

    @Prop({type: String, required: true, enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    socialMedia: SocialMediaEnum | 'multipromo';

    @Prop({required: true, type: String})
    campaignName: string;

    @Prop({required: true, type: Number})
    campaignPrice: number;

    @Prop({required: true, type: [CampaignAccountSchema]})
    addedAccounts: CampaignAccount[];

    @Prop({required: true, type: [CampaignContentItemSchema]})
    campaignContent: CampaignContentItem[];

    @Prop({required: true, type: String, enum: CampaignConfirmationEnum})
    verifyCampaign: CampaignConfirmationEnum;

    @Prop({required: false, enum: CampaignStatusEnum, default: 'under_review', type: String})
    statusCampaign: CampaignStatusEnum;

    @Prop({required: true, default: 'wait', enum: CampaignPaymentStatusEnum, type: String})
    paymentStatus: CampaignPaymentStatusEnum;

    @Prop({required: true, enum: CampaignPaymentMethodEnum, type: String})
    paymentType: CampaignPaymentMethodEnum;

    @Prop({required: true, type: String})
    shareLink: string;

    @Prop({required: false})
    replacementsNotes?: string;

    @Prop({required: false})
    partialRefund?: number;

    @Prop({required: false, type: [String]})
    hiddenColumns?: string[];

    @Prop({required: false, type: Boolean})
    isCpmAndResultHidden?: boolean;

    @Prop({required: false, type: Boolean})
    isPriceHidden?: boolean;

    @Prop({required: false, type: Boolean})
    canEdit?: boolean;

    createdAt?: Date;
    updatedAt?: Date;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
