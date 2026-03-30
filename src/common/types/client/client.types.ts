import {Types} from "mongoose";
import {SocialMediaEnum} from "../social-media.types";

// Interface for account settings page
export interface ClientAccountDetails {
    firstName: string;
    companyName: string;
    email: string;
    phone: string;

    lastName?: string;
    profilePhotoUrl?: string;
    isProposal?: boolean;
}

// Read model for admin list
export interface IAdminClientListItem {
    _id: Types.ObjectId;
    company: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string;
    companyType: string;
    isProposal: boolean;
    campaignsCompleted: number;
    campaignsActive: number;
}

// Type for campaign info for admin client details
export interface ICampaignForClientDetails {
    _id: Types.ObjectId;
    campaignName: string;
    socialMedia: SocialMediaEnum | 'multipromo';
    createdAt: Date | null;
    campaignPrice: number;
}

// Read model with client details for admin
export interface IAdminClientDetails {
    _id: Types.ObjectId;
    firstName: string;
    email: string;
    phone: string;
    companyType: string;
    isProposal: boolean;
    company: string | null;
    lastName?: string;
    campaignsActive?: ICampaignForClientDetails[];
    campaignsCompleted?: ICampaignForClientDetails[];
    latestCampaignName?: string;
    internalNote?: string;
}