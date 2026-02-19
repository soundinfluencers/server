import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Document, Types} from 'mongoose';
import {
    InfluencerProfileCategory
} from "../../../common/types/influencer/influencer.types";
import {Role} from "../../../common/types/user.types";
import {InfluencerConfirmationStatusEnum} from "../../../common/types/influencer/promo.types";

@Schema({_id: false})
export class InfluencerMusicGenre {
    @Prop({required: true, index: true})
    genre: string;

    @Prop({type: [String], default: []})
    subGenres: string[];
}

export const InfluencerMusicGenreSchema = SchemaFactory.createForClass(InfluencerMusicGenre);

@Schema({_id: false})
export class InfluencerCountryStats {
    @Prop({required: true, index: true})
    country: string;

    @Prop({type: Number, min: 0, max: 100})
    percentage: number;
}

export const InfluencerCountryStatsSchema = SchemaFactory.createForClass(InfluencerCountryStats);

@Schema({timestamps: true})
export class SocialAccount {
    @Prop({type: Types.ObjectId})
    _id: Types.ObjectId;

    @Prop({required: true, index: true})
    username: string;

    @Prop({required: true, index: true})
    profileLink: string;

    @Prop({required: true, type: Number, min: 0})
    followers: number;

    @Prop({required: true})
    logoUrl: string;

    @Prop({
        type: String,
        enum: InfluencerProfileCategory,
        default: InfluencerProfileCategory.community,
        index: true,
    })
    profileCategory: InfluencerProfileCategory;

    @Prop({type: Number, min: 0})
    price: number;

    @Prop({type: Number, min: 0})
    publicPrice: number;

    @Prop({type: String, default: null})
    currency: string | null;

    @Prop({type: Number, min: 0, default: 0})
    initialPrice: number;

    @Prop({
        type: [InfluencerCountryStatsSchema],
        default: [],
    })
    countries: InfluencerCountryStats[];

    @Prop({
        type: [InfluencerMusicGenreSchema],
        required: false
    })
    musicGenres?: InfluencerMusicGenre[];

    @Prop({type: [String], required: false, index: true})
    creatorCategories?: string[];

    @Prop({type: [String], required: false, index: true})
    categories?: string[];

    @Prop({type: Number, required: false})
    engagementRate?: number;

    @Prop({type: Number, required: false})
    averageViews?: number;

    @Prop({default: false, index: true})
    isHidden: boolean;

    @Prop({default: false, index: true})
    isDeleted: boolean;

    @Prop({default: false, index: true})
    isVerified: boolean;

    @Prop({required: false, default: InfluencerConfirmationStatusEnum.wait, enum: InfluencerConfirmationStatusEnum, type: String})
    agreementStatus?: InfluencerConfirmationStatusEnum;
}

export const SocialAccountSchema = SchemaFactory.createForClass(SocialAccount);

// Indexes for social account schema
SocialAccountSchema.index({
    isVerified: 1,
    isDeleted: 1,
    isHidden: 1,
});

@Schema({_id: false})
export class UserNotificationMethods {
    @Prop({required: false, default: true, type: Boolean})
    whatsapp: boolean;

    @Prop({required: false, default: true, type: Boolean})
    telegram: boolean;
}

export const UserNotificationMethodsSchema = SchemaFactory.createForClass(UserNotificationMethods);

@Schema({
    timestamps: true,
})
export class Influencer extends Document {
    @Prop()
    _id: Types.ObjectId;

    @Prop({type: Number, default: 2, index: true, required: false})
    schemaVersion: number;

    @Prop({required: true, type: String, enum: Role})
    role: Role;

    @Prop({default: 0})
    balance: number;

    @Prop({type: String, required: true})
    firstName: string;

    @Prop({type: String, required: false})
    lastName?: string;

    @Prop({required: false, type: String})
    logoUrl?: string;

    @Prop({lowercase: true})
    email: string;

    @Prop()
    phone: string;

    @Prop()
    password: string;

    @Prop({default: 'wait'})
    statusVerify: string;

    @Prop({default: ''})
    internalNote: string;

    @Prop({default: ''})
    currencyNote: string;

    @Prop({type: [SocialAccountSchema], default: []})
    instagram: SocialAccount[];

    @Prop({type: [SocialAccountSchema], default: []})
    tiktok: SocialAccount[];

    @Prop({type: [SocialAccountSchema], default: []})
    spotify: SocialAccount[];

    @Prop({type: [SocialAccountSchema], default: []})
    soundcloud: SocialAccount[];

    @Prop({type: [SocialAccountSchema], default: []})
    facebook: SocialAccount[];

    @Prop({type: [SocialAccountSchema], default: []})
    youtube: SocialAccount[];

    @Prop({type: [SocialAccountSchema], default: []})
    press: SocialAccount[];

    @Prop({type: UserNotificationMethodsSchema, required: false})
    notificationMethods: UserNotificationMethods;

    @Prop({default: null})
    refreshToken: string | null;

    @Prop({required: false, default: InfluencerConfirmationStatusEnum.wait, enum: InfluencerConfirmationStatusEnum, type: String})
    agreementStatus?: InfluencerConfirmationStatusEnum;
}

export const InfluencerSchema = SchemaFactory.createForClass(Influencer);

// Indexes for influencer schema
InfluencerSchema.index({email: 1}, {unique: true, background: true});
InfluencerSchema.index({role: 1}, {background: true});
InfluencerSchema.index({statusVerify: 1}, {background: true});

