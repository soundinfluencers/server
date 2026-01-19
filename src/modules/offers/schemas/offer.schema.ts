import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Types} from 'mongoose';
import {
    OfferConnectedAccount,
    OfferConnectedAccountSchema,
} from '../entities/offer-connected-account.entity';
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";

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
        type: [OfferConnectedAccountSchema],
    })
    connectedAccounts: OfferConnectedAccount[];

    @Prop({
        required: true,
    })
    price: number;

    @Prop({
        type: String,
        enum: [
            'Techno (Melodic, Minimal)',
            'Techno (Hard, Peak)',
            'House (Tech House)',
            'House (Melodic, Afro)',
            'EDM',
            'D&B',
            'Bass',
            'Psy, Trance',
            'Dubstep',
            'Garage',
            'Dance Pop',
        ],
        default: null,
        required: false,
    })
    genre?: string | null;

    @Prop({required: false, default: null})
    combinedFollowers?: string | null;

    @Prop({required: false, default: null})
    networksAmount?: number | null;

    @Prop({required: false, default: null})
    storyAndPostDetails?: string | null;

    @Prop({required: false, default: false})
    isPublished: boolean;

    @Prop({required: false, default: false})
    isDeleted: boolean;

    @Prop()
    readonly createdAt?: Date;

    @Prop()
    readonly updatedAt?: Date;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);
