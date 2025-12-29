import {Schema, Prop, SchemaFactory} from '@nestjs/mongoose';
import {Document, Types} from 'mongoose';
import {
    InfluencerProfileCategory
} from "../../../common/types/influencer/influencer.types";

@Schema({ _id: false })
export class InfluencerMusicGenre {
    @Prop({ required: true, index: true })
    genre: string;

    @Prop({ type: [String], default: [] })
    subGenres: string[];
}

export const InfluencerMusicGenreSchema = SchemaFactory.createForClass(InfluencerMusicGenre);

@Schema({ _id: false })
export class InfluencerCountryStats {
    @Prop({ required: true, index: true })
    country: string;

    @Prop({ type: Number, min: 0, max: 100 })
    percentage: number;
}

export const InfluencerCountryStatsSchema = SchemaFactory.createForClass(InfluencerCountryStats);

@Schema({ timestamps: true })
export class SocialAccount {
    @Prop({ type: Types.ObjectId })
    _id: Types.ObjectId;

    @Prop({ required: true, index: true })
    username: string;

    @Prop()
    profileLink: string;

    @Prop({ type: Number, min: 0 })
    followers: number;

    @Prop()
    logoUrl: string;

    @Prop({
        type: String,
        enum: InfluencerProfileCategory,
        default: InfluencerProfileCategory.community,
        index: true,
    })
    profileCategory: InfluencerProfileCategory;

    @Prop({ type: Number, min: 0 })
    price: number;

    @Prop({ type: Number, min: 0 })
    publicPrice: number;

    @Prop({ type: String, default: null })
    currency: string | null;

    @Prop({ type: Number, min: 0, default: 0 })
    initialPrice: number;

    @Prop({ type: Number, default: null })
    engagementRate: number | null;

    @Prop({ type: Number, default: null })
    averageViews: number | null;

    @Prop({
        type: [InfluencerMusicGenreSchema],
        default: [],
    })
    musicGenres: InfluencerMusicGenre[];

    @Prop({ type: [String], default: [], index: true })
    creatorCategories: string[];

    @Prop({
        type: [InfluencerCountryStatsSchema],
        default: [],
    })
    countries: InfluencerCountryStats[];

    @Prop({ type: [String], default: [], index: true })
    categories: string[];

    @Prop({ default: false, index: true })
    isHidden: boolean;

    @Prop({ default: false, index: true })
    isDeleted: boolean;

    @Prop({ default: false, index: true })
    isVerified: boolean;

    // @Prop({ type: Types.ObjectId })
    // _id: Types.ObjectId;
    //
    // @Prop() musicStyle: string;
    //
    // @Prop()
    // profileLink: string;
    //
    // @Prop({ type: [String], default: [] })
    // musicSubStyles: string[];
    //
    // @Prop({ type: [String], default: [] })
    // musicStyleOther: string[];
    //
    // @Prop() instagramUsername: string;
    //
    // @Prop({ required: false})
    // username: string;
    //
    // @Prop() instagramLink: string;
    //
    // @Prop() followersNumber: string;
    //
    // @Prop() logo: string;
    //
    // @Prop({
    //     type: String,
    //     enum: ['community', 'creator'],
    //     default: 'community',
    // })
    // profileCategory: 'community' | 'creator';
    //
    // @Prop() price: string;
    //
    // @Prop() publicPrice: string;
    //
    // @Prop({ type: String, default: null })
    // currency: string | null;
    //
    // @Prop({ type: Number, default: 0 })
    // initialPrice: number;
    //
    // @Prop({
    //     type: [
    //         {
    //             country: String,
    //             percentage: Number,
    //         },
    //     ],
    //     default: [],
    // })
    // countries: { country: string; percentage: number }[];
    //
    // @Prop({
    //     type: [InfluencerMusicGenreSchema],
    //     default: [],
    // })
    // musicGenres: InfluencerMusicGenre[];
    //
    // @Prop({ type: [String], default: [] })
    // categories: string[];
    //
    // @Prop({ type: Number, default: null })
    // engagementRate: number | null;
    //
    // @Prop({ type: Number, default: null })
    // averageViews: number | null;
    //
    // @Prop({ type: [String], default: [] })
    // creatorCategories: string[];
    //
    // @Prop({ default: false })
    // isHidden: boolean;
    //
    // @Prop({ default: false })
    // isDeleted: boolean;
    //
    // @Prop({ default: false })
    // isVerified: boolean;
}

export const SocialAccountSchema = SchemaFactory.createForClass(SocialAccount);

// Indexes for social account schema
SocialAccountSchema.index({
    isVerified: 1,
    isDeleted: 1,
    isHidden: 1,
});

@Schema({
    timestamps: true,
})
export class Influencer extends Document {
    @Prop()
    _id: Types.ObjectId;

    @Prop({default: 'influencer'})
    role: string;

    @Prop({default: 0})
    balance: string;

    @Prop()
    firstName: string;

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

    @Prop({default: null})
    refreshToken: string | null;
}

export const InfluencerSchema = SchemaFactory.createForClass(Influencer);

// Indexes for influencer schema
InfluencerSchema.index({ email: 1 }, { unique: true, background: true });
InfluencerSchema.index({ role: 1 }, { background: true });
InfluencerSchema.index({ statusVerify: 1 }, { background: true });

