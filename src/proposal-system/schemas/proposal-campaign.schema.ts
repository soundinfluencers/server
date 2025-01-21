import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import mongoose from "mongoose";

@Schema()
export class SelectInfluencers {
    @Prop()
    influencerId: string;

    @Prop()
    instagramUsername: string;

    @Prop()
    logo: string;
    
    @Prop({default: '0'})
    price: string;

    @Prop({default: '0'})
    publicPrice: string;

    @Prop()
    selectedVideo: string;

    @Prop()
    dateRequest: string;

    @Prop({default: 0})
    followersNumber: number;
    
    @Prop()
    genres: string[];
    
    @Prop()
    countries: object[];
}

export const SelectInfluencersSchema = SchemaFactory.createForClass(SelectInfluencers);

@Schema()
export class Video {
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
    
    @Prop()
    _id: mongoose.Schema.Types.ObjectId;
} 

export const VideoSchema = SchemaFactory.createForClass(Video);

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
        type: [VideoSchema],
        default: [],
    })
    videos: Video[];
    
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