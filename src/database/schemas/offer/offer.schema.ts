import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Types} from 'mongoose';
import {SocialMediaEnum} from "../../../common/types/social-media.types";

@Schema({
    timestamps: true,
})
export class Offer {
    @Prop({type: Types.ObjectId})
    _id: Types.ObjectId;

    @Prop({required: true})
    title: string;

    @Prop({
        required: true,
        type: String,
        enum: SocialMediaEnum,
    })
    socialMedia: SocialMediaEnum;

    @Prop({
        required: true,
    })
    price: number;

    @Prop({
        type: String,
        required: true,
    })
    genre: string;

    @Prop({required: false, default: false})
    isPublished: boolean;

    // @Prop({required: false, default: false})
    // isDeleted: boolean;

    @Prop({required: false, type: String})
    combinedFollowers?: string;

    @Prop({required: false, type: String})
    networksAmount?: string;

    @Prop({required: false, type: String})
    storyAndPostDetails?: string;

    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);
