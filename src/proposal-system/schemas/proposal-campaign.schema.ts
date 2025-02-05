import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import mongoose from "mongoose";

@Schema()
export class SelectInfluencers {
    @Prop()
    _id: mongoose.Schema.Types.ObjectId;

    @Prop()
    influencerId: mongoose.Schema.Types.ObjectId;

    @Prop()
    socialMedia: string;

    @Prop()
    socialMediaUsername: string;

    @Prop()
    confirmation: string;

    @Prop({default: '0'})
    price: string;

    @Prop({default: '0'})
    publicPrice: string;

    @Prop()
    selectedCampaignContentItem: string;

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

    @Prop({default: 0})
    followersNumber: number;
    
    @Prop({default: []})
    genres: string[];
    
    @Prop({default: []})
    countries: object[];
}
export const SelectInfluencersSchema = SchemaFactory.createForClass(SelectInfluencers);

@Schema()
export class CampaignContentItem {
    @Prop()
    _id: mongoose.Schema.Types.ObjectId;

    @Prop()
    videoLink: string;

    @Prop()
    postDescription: string;

    @Prop()
    storyTag: string;

    @Prop()
    swipeUpLink: string;

    @Prop()
    specialWishes: string;
}
const CampaignContentItemSchema = SchemaFactory.createForClass(CampaignContentItem);

@Schema({timestamps: true})
export class ProposalCampaign {
    @Prop({required: false, default: 0})
    clientId: mongoose.Schema.Types.ObjectId;
    
    @Prop({required: true})
    campaignName: string;

    @Prop({
        required: false,
        type: [SelectInfluencersSchema],
        default: [],
    })
    selectInfluencers: SelectInfluencers[];

    @Prop({
        required: false,
        type: [CampaignContentItemSchema],
        default: [],
    })
    campaignContent: CampaignContentItem[];
    
    @Prop({required: false, default: 0})
    price: number;
    
    @Prop({required: false, default: 0})
    publicPrice: number;
    
    @Prop({required: false, default: 0})
    totalFollowers: number;
    
    @Prop({required: true, default: 'instagram'})
    socialMedia: string;

    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}

export const ProposalCampaignSchema = SchemaFactory.createForClass(ProposalCampaign);