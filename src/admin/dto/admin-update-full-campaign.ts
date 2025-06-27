import { ApiProperty } from '@nestjs/swagger';

interface Influencer {
  _id: string;
  influencerId: string;
  socialMediaUsername: string;
  selectedCampaignContentItemId: string;
  followersNumber: number;
  dateRequest: string | null;
  postLink: string | null;
  screenshot: string | null;
  like: string | null;
  impressions: string | null;
  socialMedia: string | 'instagram';
  price: string;
  publicPrice: string;
}

interface CampaignContentItem {
  _id: string;
  videoLink: string;
  postDescription: string;
  storyTag: string | null;
  storyLink: string | null;
  specialWishes: string;
}

export class AdminUpdateFullCampaignDto {
  @ApiProperty({ required: true })
  campaignId: string;

  @ApiProperty({ required: true })
  campaignName: string;

  @ApiProperty({ required: true })
  campaignPrice: number;

  @ApiProperty({ required: true })
  addedInfluencers: Influencer[];

  @ApiProperty({ required: true })
  campaignContent: CampaignContentItem[];

  @ApiProperty({ required: true })
  hiddenColumns: string[] | null;

  @ApiProperty({ required: true })
  isPriceHidden: boolean;

  @ApiProperty({ required: true })
  isCpmAndResultHidden: boolean;

  @ApiProperty({ required: true })
  isProposalCampaign: boolean;
}
