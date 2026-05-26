import { ObjId } from '../base.types';
import { Role } from '../user.types';
import { Injectable, Logger } from '@nestjs/common';
import { RequestForAdminRepository } from '../../../database/repositories/requests/request-for-admin.repository';

export enum RequestForAdminType {
  NEW_CLIENT_REQUEST = 'NEW_CLIENT_REQUEST',
  NEW_INFLUENCER_REQUEST = 'NEW_INFLUENCER_REQUEST',
  CAMPAIGN_REQUEST = 'CAMPAIGN_REQUEST',
  BESPOKE_CAMPAIGN_REQUEST = 'BESPOKE_CAMPAIGN_REQUEST',
  PROPOSAL_CAMPAIGN_REQUEST = 'PROPOSAL_CAMPAIGN_REQUEST',
  NEW_SOCIAL_ACCOUNT_REQUEST = 'NEW_SOCIAL_ACCOUNT_REQUEST',
  PRICE_UPDATE_REQUEST = 'PRICE_UPDATE_REQUEST',
}

export enum RequestGroup {
  CLIENT = 'CLIENT',
  INFLUENCER = 'INFLUENCER',
  CAMPAIGN = 'CAMPAIGN',
  PRICING = 'PRICING',
}

export enum RequestLifecycleState {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum RequestSpecifiedStatus {
  WAITING_FOR_ADMIN = 'WAITING_FOR_ADMIN',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum AdminRequestResponseAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export type CreateNewClientRequestProps = {
  clientId: string;
  clientName: string;
};

export type CreateCampaignRequestProps = {
  clientId: string;
  campaignId: string;
  clientName: string;
};

export type CreateBespokeCampaignRequestProps = {
  clientId: string;
  bespokeCampaignRequestId: string;
  clientName: string;
};

export type BespokeCampaignRequestDetails = {
  _id: ObjId;
  group: RequestGroup;
  type: RequestForAdminType;
  lifecycleStatus: RequestLifecycleState;
  specifiedStatus: RequestSpecifiedStatus;
  clientId: ObjId;
  createdAt: Date;

  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;

  category: string;
  campaignGoal?: string;
  contentLink?: string;
  budget?: number;
  targetTerritories?: string;
  extraBriefs?: string;

  // music discriminator
  trackLink?: string;
  releaseDate?: Date;
  smartLink?: string;

  // event discriminator
  ticketLink?: string;
};

export type NewClientRequestDetails = {
  _id: ObjId;
  group: RequestGroup;
  type: RequestForAdminType;
  lifecycleStatus: RequestLifecycleState;
  userFirstName: string;
  userRole: Role;
  reviewedAt?: Date;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;

  specifiedStatus: RequestSpecifiedStatus;
  clientId: ObjId;
  rejectionReason?: string;

  lastName: string;
  phone: string;
  email: string;
  company: string;
  companyType: string;
  referralCode: string;
};

export type CampaignRequestContentItemRaw = {
  socialMedia: string;
  mainLink: string;
  descriptions: string[];
  accounts: string[];
  additionalBrief?: string;
  dateRequest?: string;
};

export type CampaignRequestDetails = {
  _id: ObjId;
  group: RequestGroup;
  type: RequestForAdminType;
  lifecycleStatus: RequestLifecycleState;
  specifiedStatus: RequestSpecifiedStatus;
  clientId: ObjId;
  createdAt: Date;

  firstName: string;
  lastName: string;
  email: string;

  campaignName: string;
  paymentMethod: string;
  items: CampaignRequestContentItemRaw[];
};

export interface IAdminRequest {
  _id: ObjId;
  group: RequestGroup;
  type: RequestForAdminType;
  userFirstName: string;
  userRole: Role;
  createdAt: Date;
  lifecycleStatus: RequestLifecycleState;
  specifiedStatus: RequestSpecifiedStatus;
}
