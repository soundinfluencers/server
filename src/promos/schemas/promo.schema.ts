import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Types} from "mongoose";

// @Schema({strict: false})
@Schema()
export class SelectInfluencers {
    @Prop({ type: Types.ObjectId, required: true }) 
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    influencerId: Types.ObjectId;
    
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
}
const SelectInfluencersSchema = SchemaFactory.createForClass(SelectInfluencers);

@Schema()
export class CampaignContentItem {
    @Prop({ type: Types.ObjectId, required: true })
    _id: Types.ObjectId;
    
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

@Schema({
    timestamps: true,
    // strict: false,
})
export class Promos {
    @Prop({ type: Types.ObjectId })
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

    //TODO: заменить поле на массив использованных соц сетей 
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
    
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}

export const PromosSchema = SchemaFactory.createForClass(Promos);
