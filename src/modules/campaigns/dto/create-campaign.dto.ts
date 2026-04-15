import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {IsArray, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested} from "class-validator";
import {Type} from "class-transformer";
import {CreateCampaignInvoiceDto} from "../../invoice/dto/create-invoice.dto";
import {CampaignDraftLatestStep} from "../../../common/types/client/campaign.types";

// DTO with selected content items _ids
export class SelectedCampaignContentItemDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    campaignContentItemId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    descriptionId?: string;
}

export class SelectInfluencerDto {
    @ApiProperty({required: true})
    @IsMongoId()
    socialAccountId: string;

    @ApiProperty({required: true})
    @IsMongoId()
    influencerId: string;

    @ApiProperty({required: true, enum: SocialMediaEnum})
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiProperty({required: true})
    @IsString()
    username: string;

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
    // front does not send this. this field is setting and using only by backend
    clientId?: string;

    @ApiProperty({required: true})
    @IsString()
    campaignName: string;

    @ApiProperty({required: true, enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    @IsEnum([...Object.values(SocialMediaEnum), 'multipromo'])
    socialMedia: SocialMediaEnum | 'multipromo';

    @ApiProperty({required: true})
    @IsNumber()
    @Type(() => Number)
    campaignPrice: number;

    @ApiProperty({type: () => [SelectInfluencerDto]})
    @Type(() => SelectInfluencerDto)
    @IsArray()
    @IsNotEmpty()
    @ValidateNested({ each: true })
    addedAccounts: SelectInfluencerDto[];

    @ApiProperty({type: () => [CampaignContentItemDto]})
    @Type(() => CampaignContentItemDto)
    @IsArray()
    @IsNotEmpty()
    @ValidateNested({ each: true })
    campaignContent: CampaignContentItemDto[];

    @ApiPropertyOptional({ type: () => CreateCampaignInvoiceDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => CreateCampaignInvoiceDto)
    paymentDetails?: CreateCampaignInvoiceDto;
}

export class DraftCampaignNewAccountDto {
    @ApiProperty({example: '6659bd485bc4317ed7c73555'})
    @IsMongoId()
    influencerId: string;

    @ApiProperty({example: '6659bd485bc4317ed7c73556'})
    @IsMongoId()
    socialAccountId: string;

    @ApiProperty({required: true, enum: SocialMediaEnum})
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiPropertyOptional({description: 'Selected content configuration', type: SelectedCampaignContentItemDto})
    @IsOptional()
    @ValidateNested()
    @Type(() => SelectedCampaignContentItemDto)
    selectedContent?: SelectedCampaignContentItemDto;
}

// dto for creating campaign draft
export class SaveDraftCampaignDto {
    clientId?: string;

    @ApiProperty({
        enum: [...Object.values(SocialMediaEnum), 'multipromo'],
        example: SocialMediaEnum.instagram,
    })
    @IsEnum([...Object.values(SocialMediaEnum), 'multipromo'])
    socialMedia: SocialMediaEnum | 'multipromo';

    @ApiProperty({enum: CampaignDraftLatestStep})
    @IsEnum(CampaignDraftLatestStep)
    step: CampaignDraftLatestStep;

    @ApiProperty({type: [DraftCampaignNewAccountDto]})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => DraftCampaignNewAccountDto)
    addedAccounts: DraftCampaignNewAccountDto[];

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    draftId: string;

    @ApiPropertyOptional({type: [CampaignContentItemDto]})
    @IsOptional()
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CampaignContentItemDto)
    campaignContent?: CampaignContentItemDto[];

    @ApiPropertyOptional({example: 'My first draft campaign'})
    @IsOptional()
    @IsString()
    campaignName?: string;
}