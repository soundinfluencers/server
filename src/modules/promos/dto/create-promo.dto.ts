import { ApiProperty } from '@nestjs/swagger';

export class SelectedCampaignContentItemDto {
  @ApiProperty()
  campaignContentItemId: string;

  @ApiProperty()
  postDescriptionId: string;
}

export class SelectInfluencerDto {
  @ApiProperty({ required: false })
  socialMediaAccountId: string;

  @ApiProperty({ required: false })
  influencerId: string;

  @ApiProperty()
  socialMedia: string;

  @ApiProperty()
  socialMediaUsername: string;

  @ApiProperty({ type: () => SelectedCampaignContentItemDto })
  selectedCampaignContentItem: SelectedCampaignContentItemDto;

  @ApiProperty()
  dateRequest: string;
}

export class PostDescriptionDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  description: string;
}

export class CampaignContentItemDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  videoLink: string;

  @ApiProperty({ type: () => [PostDescriptionDto] })
  postDescriptions: PostDescriptionDto[];

  @ApiProperty()
  storyTag: string;

  @ApiProperty({ required: false, default: undefined })
  swipeUpLink: string;

  @ApiProperty({ required: false, default: undefined })
  specialWishes?: string;

  @ApiProperty({ required: true, default: 'instagram' })
  socialMedia: string;

  @ApiProperty({ required: true, default: 'main' })
  socialMediaGroup: string;
}

export class CreatePromosDto {
  @ApiProperty({ required: true })
  clientId: string;

  @ApiProperty({ type: () => [SelectInfluencerDto] })
  selectInfluencers: SelectInfluencerDto[];

  @ApiProperty({ type: () => [CampaignContentItemDto] })
  campaignContent: CampaignContentItemDto[];

  @ApiProperty({ required: true })
  campaignName: string;

  @ApiProperty({ required: true })
  paymentType: string;

  @ApiProperty({ required: true, default: 'wait' })
  paymentStatus: string;

  @ApiProperty({ required: true })
  campaignPrice: number;

  @ApiProperty({ required: true })
  createdAt: string;

  @ApiProperty({ required: true })
  socialMedia: string;
}
