import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {IsArray, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested} from "class-validator";
import {Type} from "class-transformer";

export class SelectedCampaignContentItemDto {
    @ApiProperty()
    @IsMongoId()
    campaignContentItemId: string;

    @ApiProperty()
    @IsMongoId()
    descriptionId: string;
}

export class SelectInfluencerDto {
    @ApiProperty({required: true})
    @IsMongoId()
    socialMediaAccountId: string;

    @ApiProperty({required: true})
    @IsMongoId()
    influencerId: string;

    @ApiProperty({required: true, enum: SocialMediaEnum})
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiProperty({required: true})
    @IsString()
    socialMediaUsername: string;

    @ApiProperty({type: () => SelectedCampaignContentItemDto, required: true})
    @Type(() => SelectedCampaignContentItemDto)
    @ValidateNested()
    @IsNotEmpty()
    selectedCampaignContentItem: SelectedCampaignContentItemDto;

    @ApiProperty({required: true})
    @IsString()
    dateRequest: string;
}

export class PostDescriptionDto {
    @ApiProperty({required: true})
    @IsMongoId()
    _id: string;

    @ApiProperty({required: true})
    @IsString()
    description: string;
}

export class CampaignContentItemDto {
    @ApiProperty({required: true})
    @IsMongoId()
    _id: string;

    @ApiProperty({required: true, enum: SocialMediaEnum})
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiProperty({required: true})
    @IsString()
    socialMediaGroup: string;

    @ApiProperty({required: true})
    @IsString()
    mainLink: string; // main link (was videoLink) -> for video that influencer will use

    @ApiProperty({type: () => [PostDescriptionDto], required: true})
    @Type(() => PostDescriptionDto)
    @IsArray()
    @IsNotEmpty()
    @ValidateNested()
    @IsOptional()
    descriptions?: PostDescriptionDto[]; // was postDescriptions

    @ApiPropertyOptional({required: false})
    @IsString()
    @IsOptional()
    taggedUser?: string; // was storyTag

    @ApiPropertyOptional({required: false})
    @IsString()
    @IsOptional()
    taggedLink?: string; // secondary link (was storyLink) -> influencer can use it if promo need to show reference for video, track

    @ApiPropertyOptional({required: false})
    @IsString()
    @IsOptional()
    additionalBrief?: string; // was specialWishes
}

// dto for creating campaign
export class CreateCampaignDto {
    clientId?: string;

    @ApiProperty({required: true})
    @IsString()
    campaignName: string;

    @ApiProperty({required: true, enum: SocialMediaEnum})
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiProperty({required: true})
    @IsNumber()
    @Type(() => Number)
    campaignPrice: number;

    @ApiProperty({required: true})
    @IsString()
    paymentType: string;

    @ApiProperty({type: () => [SelectInfluencerDto]})
    @Type(() => SelectInfluencerDto)
    @IsArray()
    @IsNotEmpty()
    @ValidateNested()
    addedAccounts: SelectInfluencerDto[];

    @ApiProperty({type: () => [CampaignContentItemDto]})
    @Type(() => CampaignContentItemDto)
    @IsArray()
    @IsNotEmpty()
    @ValidateNested()
    campaignContent: CampaignContentItemDto[];
}

export class DraftCampaignAccountDto {
    @ApiProperty({example: '6659bd485bc4317ed7c73555'})
    @IsMongoId()
    influencerId: string;

    @ApiProperty({example: '6659bd485bc4317ed7c73556'})
    @IsMongoId()
    accountId: string;

    @ApiProperty({description: 'Selected content configuration', type: SelectedCampaignContentItemDto})
    @ValidateNested()
    @Type(() => SelectedCampaignContentItemDto)
    selectedContent: SelectedCampaignContentItemDto;
}

// dto for creating campaign draft
export class CreateDraftCampaignDto {
    clientId?: string;

    @ApiProperty({type: [DraftCampaignAccountDto]})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => DraftCampaignAccountDto)
    addedAccounts: DraftCampaignAccountDto[];

    @ApiProperty({type: [CampaignContentItemDto]})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CampaignContentItemDto)
    campaignContent: CampaignContentItemDto[];

    @ApiProperty({example: 'My first draft campaign'})
    @IsString()
    campaignName: string;

    @ApiProperty({
        enum: [...Object.values(SocialMediaEnum), 'multipromo'],
        example: SocialMediaEnum.instagram,
    })
    @IsEnum([...Object.values(SocialMediaEnum), 'multipromo'])
    socialMedia: SocialMediaEnum | 'multipromo';
}