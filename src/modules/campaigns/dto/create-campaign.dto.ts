import { ApiProperty } from '@nestjs/swagger';
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {IsArray, IsEnum, IsMongoId, IsString, ValidateNested} from "class-validator";
import {Type} from "class-transformer";

export class SelectedCampaignContentItemDto {
  @ApiProperty()
  @IsMongoId()
  campaignContentItemId: string;

  @ApiProperty()
  @IsMongoId()
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
  @IsMongoId()
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

// todo: add class validator
// dto for creating campaign
export class CreateCampaignDto {
  clientId?: string;

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

export class DraftCampaignAccountDto {
    @ApiProperty({ example: '6659bd485bc4317ed7c73555' })
    @IsMongoId()
    influencerId: string;

    @ApiProperty({ example: '6659bd485bc4317ed7c73556' })
    @IsMongoId()
    accountId: string;

    @ApiProperty({ description: 'Selected content configuration', required: false })
    @ValidateNested()
    @Type(() => SelectedCampaignContentItemDto)
    selectedContent: SelectedCampaignContentItemDto;
}

// dto for creating campaign draft
export class CreateDraftCampaignDto {
    clientId?: string;

    @ApiProperty({ type: [DraftCampaignAccountDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DraftCampaignAccountDto)
    addedAccounts: DraftCampaignAccountDto[];

    @ApiProperty({ type: [CampaignContentItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampaignContentItemDto)
    campaignContent: CampaignContentItemDto[];

    @ApiProperty({ example: 'My first draft campaign' })
    @IsString()
    campaignName: string;

    @ApiProperty({
        enum: [...Object.values(SocialMediaEnum), 'multipromo'],
        example: SocialMediaEnum.instagram,
    })
    @IsEnum([...Object.values(SocialMediaEnum), 'multipromo'])
    socialMedia: SocialMediaEnum | 'multipromo';
}