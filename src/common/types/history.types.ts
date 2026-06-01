import {ObjId} from "./base.types";
import {SocialMediaEnum} from "./social-media.types";
import {PaymentHistoryCampaignSource} from "../../database/schemas/histories/payment-history-cell.schema";
import {CampaignStatusEnum} from "./client/campaign.types";
import {InvoiceStatusEnum} from "./invoice.types";
import {AdminCampaignsListStatusEnum} from "../../modules/admin/dto/campaigns/admin-campaigns.dto";

// Enum of available history actions types
export enum InfluencerHistoryActionType {
    campaign = "campaign",
    invoice = "invoice",
}

// Read model for latest campaign actions page
export interface ILatestCampaignAction {
    influencerId: ObjId;
    influencerName: string;
    socialMedia: SocialMediaEnum;
    username: string;
    campaignName: string;
    actionNumber: number;
    date: Date;
}

// Read model for social account's actions history
export interface ICampaignAction {
    type: InfluencerHistoryActionType.campaign;
    _id: ObjId; // CampaignAction _id
    campaignId: ObjId;
    campaignStatus: AdminCampaignsListStatusEnum; // for campaign management page redirect
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

// Automatic status calculated by the backend for a payment history cell.
// This reflects the system's view of the account's progress in a campaign,
// without any manual admin override applied.
export enum PaymentHistorySystemStatusEnum {
    // The account is in the campaign, but the payment flow is not fully completed yet.
    // This includes cases where the influencer has not accepted the campaign yet,
    // is still working on it, or has completed the work but has not sent an invoice.
    in_process = 'in_process',

    // The account has completed all required work and the influencer has sent an invoice.
    // This is the final automatic status produced by the system.
    done = 'done',
}

// Manual status set by an admin.
// This does not come from the automatic system logic and is used
// to explicitly mark a payment history cell as paid.
export enum PaymentHistoryAdminOverrideStatusEnum {
    // Admin manually confirmed that the payment was made.
    // When this value is set, it overrides the automatic system status in the UI.
    paid = 'paid',
}

// Final status returned to the frontend and used for UI rendering.
// This is the resolved status after combining the automatic system status
// with the optional manual admin override.
export enum PaymentHistoryEffectiveStatusEnum {
    // Final status is "in_process" when no admin override exists
    // and the automatic system status is still in progress.
    in_process = 'in_process',

    // Final status is "done" when no admin override exists
    // and the automatic system status is completed.
    done = 'done',

    // Final status is "paid" when an admin manually marks the cell as paid.
    // This value has priority over the automatic system status.
    paid = 'paid',
}

export type PaymentHistoryProjection = {
    _id?: ObjId;
    campaignSource: PaymentHistoryCampaignSource;
    campaignId: ObjId;
    accountId: ObjId;
    influencerId: ObjId;
    campaignName: string;
    campaignCreatedAt: Date;
    campaignStatus: CampaignStatusEnum;
    socialMedia: SocialMediaEnum;
    username: string;
    price: number;
    followers: number;
    invoiceStatus: InvoiceStatusEnum;
    influencerName: string;
    influencerEmail: string;
    influencerLogoUrl: string;
    systemStatus: PaymentHistorySystemStatusEnum;
    adminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;
    effectiveStatus: PaymentHistoryEffectiveStatusEnum;
}