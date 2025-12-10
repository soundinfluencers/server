import {Types} from "mongoose";
import {SocialMediaType} from "../social-media.types";

export interface InfluencerPastPromo {
    promoId: string | Types.ObjectId;
    campaignName: string;
    influencerId: string | Types.ObjectId;
    socialMediaUsername: string;
    dateRequest: string | Date;
    client: string;
    socialMedia: SocialMediaType;
    videoLink: string;
    postDescription: string;
    storyTag?: string;
    storyLink?: string;
    specialWishes?: string;
}