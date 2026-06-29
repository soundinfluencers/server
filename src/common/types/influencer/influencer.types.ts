import { UserNotificationMethods } from '../../../database/schemas/users/influencer.schema';
import { CurrencyCode } from '../finance.types';
import { SocialMediaEnum } from '../social-media.types';
import { ObjId } from '../base.types';

export enum InfluencerProfileCategory {
  community = 'community',
  creator = 'creator',
}

export enum CommunityMusicGenres {
  TECHNO_MELODIC_MINIMAL = 'techno_melodic_minimal',
  TECHNO_HARD_PEAK = 'techno_hard_peak',
  HOUSE_TECH_HOUSE = 'house_tech_house',
  HOUSE_MELODIC_AFRO = 'house_melodic_afro',
  EDM = 'edm',
  DRUM_AND_BASS = 'drum_and_bass',
  BASS = 'bass',
  PSY_TRANCE = 'psy_trance',
  DUBSTEP = 'dubstep',
  HIP_HOP = 'hip_hop',
  POP = 'pop',
}

export enum CommunityThemeTopics {
  IBIZA = 'ibiza',
  DANCING = 'dancing',
  MEME = 'meme',
}

export enum CreatorMusicGenres {
  ELECTRONIC_TECHNO_MELODIC_MINIMAL = 'electronic_techno_melodic_minimal',
  ELECTRONIC_TECHNO_HARD_PEAK = 'electronic_techno_hard_peak',
  ELECTRONIC_HOUSE_TECH_HOUSE = 'electronic_house_tech_house',
  ELECTRONIC_HOUSE_MELODIC_AFRO = 'electronic_house_melodic_afro',
  ELECTRONIC_EDM = 'electronic_edm',
  ELECTRONIC_DRUM_AND_BASS = 'electronic_drum_and_bass',
  ELECTRONIC_BASS = 'electronic_bass',
  ELECTRONIC_PSY_TRANCE = 'electronic_psy_trance',
  ELECTRONIC_DUBSTEP = 'electronic_dubstep',
  MAINSTREAM_POP = 'mainstream_pop',
  MAINSTREAM_HIP_HOP = 'mainstream_hip_hop',
  MAINSTREAM_ARABIC = 'mainstream_arabic',
  MAINSTREAM_K_POP = 'mainstream_k_pop',
  MAINSTREAM_METAL_ROCK = 'mainstream_metal_rock',
  MAINSTREAM_LATIN = 'mainstream_latin',
}

export enum CreatorContentFocus {
  MUSIC_DANCE = 'music_dance',
  MUSIC_LIPSYNC = 'music_lipsync',
  MUSIC_REACTIONS = 'music_reactions',
  MUSIC_LYRICS = 'music_lyrics',
  ENTERTAINMENT_LIFESTYLE = 'entertainment_lifestyle',
  ENTERTAINMENT_FASHION = 'entertainment_fashion',
  ENTERTAINMENT_FITNESS_SPORT = 'entertainment_fitness_sport',
  ENTERTAINMENT_BEAUTY = 'entertainment_beauty',
  ENTERTAINMENT_TRAVEL = 'entertainment_travel',
  ENTERTAINMENT_FAMILY = 'entertainment_family',
  ENTERTAINMENT_COMEDY = 'entertainment_comedy',
  ENTERTAINMENT_COSPLAY = 'entertainment_cosplay',
  ENTERTAINMENT_FOOD = 'entertainment_food',
  ENTERTAINMENT_ART = 'entertainment_art',
}

export enum SocialAccountLabelStatus {
  accept = 'accept',
  decline = 'decline',
  waitForAdmin = 'waitForAdmin',
  waitForUser = 'waitForUser',
  negotiation = 'negotiation',
  priceChanged = 'priceChanged',
}

export enum AgreementType {
  profileCreate = 'profileCreate',
  accountAdd = 'accountAdd',
}

export interface SocialAccountForAccountDetails {
  accountId: string;
  username: string;
  labelStatus: SocialAccountLabelStatus;
}

// interface for account settings page
export interface InfluencerAccountDetails {
  firstName: string;
  email: string;
  phone: string;
  notificationMethods: UserNotificationMethods;

  instagram: SocialAccountForAccountDetails[];
  tiktok: SocialAccountForAccountDetails[];
  spotify: SocialAccountForAccountDetails[];
  youtube: SocialAccountForAccountDetails[];
  facebook: SocialAccountForAccountDetails[];
  soundcloud: SocialAccountForAccountDetails[];
  press: SocialAccountForAccountDetails[];

  lastName?: string;
  telegramUsername?: string;
  logoUrl?: string;
}

export enum SocialAccountSortByEnum {
  bestMatch = 'bestMatch',
  lowestPrice = 'lowestPrice',
  highestPrice = 'highestPrice',
  lowestFollowers = 'lowestFollowers',
  highestFollowers = 'highestFollowers',
}

// enum for influencer's history campaign action status
export enum HistoryCampaignActionStatus {
  pending = 0, // influencer got new promo (can accept/deny)
  inDistribution = 1, // influencer accepted this promo request (can post & submit insights)
  insightsSubmitted = 2, // influencer submitted insights (can create invoice for this promo)
  invoiceSubmitted = 3, // influencer submitted invoice for this promo and waiting for payment
  paid = 4, // influencer got payment
  denied = 5, // influencer denied this promo request
  addedByAdmin = 6, // Admin added social account to campaign
  insightsSubmittedByAdmin = 7, // Admin submitted insights and sent money for this promo
}

// record for influencer's history campaign action status
export const HistoryCampaignActionStatusLabel: Record<HistoryCampaignActionStatus, string> = {
  [HistoryCampaignActionStatus.pending]: 'Campaign Pending Approval',
  [HistoryCampaignActionStatus.inDistribution]: 'Campaign Accepted',
  [HistoryCampaignActionStatus.insightsSubmitted]: 'Insights Submitted',
  [HistoryCampaignActionStatus.invoiceSubmitted]: 'Invoice Submitted',
  [HistoryCampaignActionStatus.paid]: 'Paid',
  [HistoryCampaignActionStatus.denied]: 'Campaign Declined',
  [HistoryCampaignActionStatus.addedByAdmin]: 'Added In Campaign By Admin',
  [HistoryCampaignActionStatus.insightsSubmittedByAdmin]: 'Insights Submitted By Admin',
};

export interface ShortSocialAccountInfo {
  accountId: string;
  socialMedia: SocialMediaEnum;
  username: string;
  price: number;
}

// Read model for admin list
export interface AdminInfluencerListItem {
  influencerId: ObjId; // influencer's _id
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string;
  balance: number;
  accountId: ObjId; // social account's _id
  username: string; // social account's username
  socialMedia: SocialMediaEnum;
  logoUrl: string;
  followers: number;
  profileLink: string;
  publicPrice: number; // show to clients
  price: number; // real price. real price = initial price * exchange rate
  initialPrice: number; // price that was chosen by account's owner
  currency: CurrencyCode; // currency that was chosen by account's owner
  costPerFollower: number;
  isHidden: boolean;
  internalNote?: string;
}
