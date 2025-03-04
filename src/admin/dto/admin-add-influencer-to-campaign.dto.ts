import {ApiProperty} from '@nestjs/swagger';
import {Prop} from "@nestjs/mongoose";

export class AdminAddInfluencerToCampaignDto {
    @Prop()
    _id: string;

    @Prop()
    influencerId: string;

    @Prop()
    socialMediaUsername: string;

    @Prop({default: 'wait'})
    confirmation: string;

    @Prop()
    selectedCampaignContentItem: string;

    @Prop({default: 'ASAP'})
    dateRequest: string;

    @Prop({ default: 'wait' })
    closePromo: string;

    @Prop({ default: '' })
    postLink: string;

    @Prop({ default: '' })
    screenshot: string;

    @Prop({ default: '' })
    impressions: string;

    @Prop({ default: '' })
    like: string;
    
    @Prop({ default: '' })
    newVideoLink: string;

    @Prop({ default: 'instagram' })
    socialMedia: string;
}