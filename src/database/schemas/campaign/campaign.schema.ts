import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from 'mongoose';

@Schema({_id: false, timestamps: false})
export class SelectedContent {
    @Prop({type: Types.ObjectId, required: true})
    campaignContentItemId: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true})
    postDescriptionId: Types.ObjectId;
}

export const SelectedContentSchema = SchemaFactory.createForClass(SelectedContent);

@Schema({timestamps: true})
export class SelectInfluencers {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true, ref: "Influencer"})
    influencerId: Types.ObjectId;

    @Prop({type: Types.ObjectId, required: true, ref: "SocialAccount"})
    accountId: Types.ObjectId;

    @Prop({default: 'instagram'})
    socialMedia: string;

    @Prop()
    socialMediaUsername: string;

    @Prop({default: 'wait'})
    confirmation: string;

    @Prop({default: '0'})
    price: string;

    @Prop({default: '0'})
    publicPrice: string;

    @Prop({type: SelectedContentSchema})
    selectedContent: SelectedContent;

    @Prop()
    dateRequest: string;

    @Prop({default: 'wait'})
    closePromo: string;

    @Prop({default: ''})
    postLink: string;

    @Prop({default: ''})
    screenshot: string;

    @Prop({default: ''})
    impressions: string;

    @Prop({default: ''})
    like: string;

    @Prop({default: null})
    rating: number | null;

    @Prop({default: false})
    adminChecked: boolean | null;

    @Prop({default: 0})
    followersNumber: number;

    @Prop({type: Date})
    createdAt?: Date;

    @Prop({type: Date})
    updatedAt?: Date;
}

const SelectInfluencersSchema = SchemaFactory.createForClass(SelectInfluencers);

@Schema()
export class CampaignContentItem {
    @Prop({type: Types.ObjectId, required: true})
    _id: Types.ObjectId;

    @Prop()
    videoLink: string;

    @Prop()
    postDescriptions: {
        _id: Types.ObjectId;
        description: string;
    }[];

    @Prop({required: false, default: undefined})
    storyTag: string;

    @Prop({required: false, default: undefined})
    swipeUpLink: string;

    @Prop({required: false, default: undefined})
    specialWishes: string;

    @Prop({required: true, default: 'instagram'})
    socialMedia: string;

    @Prop({required: true, default: 'main'})
    socialMediaGroup: string;
}

export const CampaignContentItemSchema = SchemaFactory.createForClass(CampaignContentItem);

@Schema({
    timestamps: true,
    // strict: false,
})
export class Campaign {
    @Prop({type: Types.ObjectId, ref: 'Client', required: true})
    clientId: Types.ObjectId;

    @Prop({
        required: true,
        type: [SelectInfluencersSchema],
    })
    selectInfluencers: SelectInfluencers[];

    @Prop({
        type: [CampaignContentItemSchema],
    })
    campaignContent: CampaignContentItem[];

    @Prop()
    campaignName: string;

    @Prop({required: true, default: 'payment'})
    paymentType: string;

    @Prop({required: true, default: 'wait'})
    paymentStatus: string;

    @Prop({required: true})
    statusCampaign: string;

    @Prop({required: true})
    campaignPrice: number;

    @Prop({default: 'wait'})
    verifyCampaign: string;

    @Prop({required: false, default: ''})
    replacementsNotes: string;

    @Prop({required: false, default: 0})
    partialRefund: number;

    @Prop({required: true})
    socialMedia: string;

    @Prop({required: false, default: false})
    isCpmAndResultHidden: boolean;

    @Prop({required: false, default: false})
    isPriceHidden: boolean;

    @Prop({required: false, default: false})
    isCopy: boolean;

    @Prop({required: false, default: `${process.env.SERVER_CLIENT}`})
    shareLink: string;

    @Prop({required: false, default: []})
    hiddenColumns: string[];

    @Prop({type: Date})
    createdAt?: Date;

    @Prop({type: Date})
    updatedAt?: Date;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
