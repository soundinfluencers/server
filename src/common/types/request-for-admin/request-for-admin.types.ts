import {ObjId} from "../base.types";
import {Role} from "../user.types";

export enum RequestForAdminType {
    NEW_CLIENT_REQUEST = 'NEW_CLIENT_REQUEST',
    NEW_INFLUENCER_REQUEST = 'NEW_INFLUENCER_REQUEST',
    CAMPAIGN_REQUEST = 'CAMPAIGN_REQUEST',
    BESPOKE_CAMPAIGN_REQUEST = 'BESPOKE_CAMPAIGN_REQUEST',
    PROPOSAL_CAMPAIGN_REQUEST = 'PROPOSAL_CAMPAIGN_REQUEST',
    NEW_SOCIAL_ACCOUNT_REQUEST = 'NEW_SOCIAL_ACCOUNT_REQUEST',
    PRICE_UPDATE_REQUEST = 'PRICE_UPDATE_REQUEST',
}

export enum RequestLifecycleState {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
    CANCELLED = 'CANCELLED',
}

export enum NewClientRequestStatus {
    WAITING_FOR_ADMIN = 'WAITING_FOR_ADMIN',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export enum NewInfluencerRequestStatus {
    WAITING_FOR_ADMIN = 'WAITING_FOR_ADMIN',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export enum PriceUpdateRequestStatus {
    WAITING_FOR_ADMIN = 'WAITING_FOR_ADMIN',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export enum AdminRequestResponseAction {
    ACCEPT = "accept",
    DECLINE = "decline",
}

export interface IAdminRequest {
    _id: ObjId;
    type: RequestForAdminType;
    userFirstName: string;
    userRole: Role;
    status: RequestLifecycleState;
    createdAt: Date;
}