import {Types} from "mongoose";

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

// Type for admin client list read model
export type ClientLatestCampaign = {
    campaignName: string;
    _id: Types.ObjectId;
}

// Read model for admin list
export interface AdminClientListItem {
    company: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string;
    companyType: string;
    _id: Types.ObjectId;
    isProposal: boolean;
    campaignsCompleted: number;
    campaignsActive: number;
    latestCampaign?: ClientLatestCampaign;
    internalNote?: string;
}