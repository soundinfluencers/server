import { ApiProperty } from '@nestjs/swagger';

interface campaignContentItemType {
  _id: string;
  videoLink: string;
  postDescriptions: {
    _id: string;
    description: string;
  }[];
  storyTag: string;
  swipeUpLink: string;
  specialWishes: string;
  socialMedia: string;
  socialMediaGroup: string;
}

interface selectInfluencersType {
  _id: string;
  influencerId: string;
  socialMediaUsername: string;
  price: string;
  publicPrice: string;
  selectedContent: {
    campaignContentItemId: string;
    postDescriptionId: string;
  };
  dateRequest: string;
  followersNumber: number;
  socialMedia: string;
  genres: string[] | undefined;
  countries: object[] | undefined;
}

export class SaveProposalCampaignDto {
  @ApiProperty({ required: true })
  campaignId: string;

  @ApiProperty({ required: false })
  clientId: string;

  @ApiProperty({ required: true })
  campaignName: string;

  @ApiProperty({ required: false })
  selectInfluencers: selectInfluencersType[];

  @ApiProperty({ required: false })
  campaignContent: campaignContentItemType[];

  @ApiProperty({ required: false, default: 0 })
  publicPrice: number;

  @ApiProperty({ required: false, default: 0 })
  price: number;

  @ApiProperty({ required: false, default: 0 })
  totalFollowers: number;

  @ApiProperty({ required: true })
  socialMedia: string;

  @ApiProperty({ required: false, default: [] })
  hiddenColumns: string[];
}
