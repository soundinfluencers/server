import {ObjId} from "./base.types";
import {SocialMediaEnum} from "./social-media.types";

// Enum of available history actions types
export enum InfluencerHistoryActionType {
    campaign = "campaign",
    invoice = "invoice",
}

// Read model for social account's actions history
export interface ICampaignAction {
    type: InfluencerHistoryActionType.campaign;
    _id: ObjId; // CampaignAction _id
    campaignId: ObjId;
    addedAccountsId: ObjId; // campaign.addedAccounts _id
    socialAccountId: ObjId; // _id of social account
    socialMedia: SocialMediaEnum; // account's socialMedia
    username: string;
    campaignName: string;
    reward: number;
    actionNumber: number;
    currentBalance: number;
    date: Date;
    isStillInCampaign?: boolean; // is this social account still in campaign or was removed
}

// Read model for influencer's invoices actions history
export interface IInvoiceAction {
    type: InfluencerHistoryActionType.invoice;
    _id: ObjId; // InvoiceAction _id
    invoiceId: ObjId; // invoice _id
    amount: number;
    paymentMethod: string;
    currentBalance: number;
    date: Date;
}

// Read model for influencer's actions history
export interface IInfluencerHistory {
    _id: ObjId;
    influencerId: ObjId;
    influencerEmail: string;
    actions: (ICampaignAction | IInvoiceAction)[];
}