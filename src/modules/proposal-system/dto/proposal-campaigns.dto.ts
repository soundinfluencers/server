import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {ProposalCampaignsListItem} from "../types/proposal-system.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {
    ArrayNotEmpty,
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested
} from "class-validator";
import {Type} from "class-transformer";
import {Role} from "../../../common/types/auth.types";
import {SafeCampaignAccount, SafeCampaignContent} from "../../../common/types/client/campaign.types";

// ------------ BASE TYPES --------------


// interface for addedAccounts
export class ProposalCampaignAccountDto extends SafeCampaignAccount {
    @ApiPropertyOptional({ type: String, isArray: true, description: 'Optional list of genres' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @ArrayNotEmpty()
    genres?: string[];

    @ApiPropertyOptional({
        type: Object,
        isArray: true,
        description: 'Optional list of countries (objects). Consider making a CountryDto for strict validation.',
    })
    @IsOptional()
    @IsArray()
    @IsObject({ each: true })
    @ArrayNotEmpty()
    countries?: object[];
}

// base proposal campaign option dto
class BaseProposalCampaignOptionDto {
    @ApiProperty({type: Number})
    @Type(() => Number)
    @IsNumber()
    optionNumber: number;

    @ApiProperty({type: Number})
    @Type(() => Number)
    @IsNumber()
    price: number;

    @ApiProperty({type: ProposalCampaignAccountDto || SafeCampaignAccount, isArray: true})
    @IsArray()
    @IsNotEmpty()
    @ValidateNested()
    addedAccounts: ProposalCampaignAccountDto[] | SafeCampaignAccount[];

    @ApiProperty({type: SafeCampaignContent, isArray: true})
    @IsArray()
    @IsNotEmpty()
    @ValidateNested()
    campaignContent: SafeCampaignContent[];
}

// base proposal campaign dto
class BaseProposalCampaignDto {
    @ApiProperty({type: String})
    @IsString()
    @IsNotEmpty()
    campaignId: string;

    @ApiProperty({type: String})
    @IsString()
    @IsNotEmpty()
    campaignName: string;

    @ApiProperty({type: String, enum: SocialMediaEnum})
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiProperty({type: Number, isArray: true})
    @IsArray()
    @IsNotEmpty()
    existingOptions: number[];
}


// ------------ REQUESTS --------------


// dto for requesting one proposal campaign (with 1 selected option)
export class GetProposalCampaignQueryDto {
    @ApiProperty({required: true})
    @IsString()
    campaignId: string;

    @ApiProperty({required: false, default: 0})
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    optionNumber: number;

    userId: string;
    userRole: Role;
}


// TODO: add class validator
// dto for requesting list of proposal campaigns
export class GetProposalCampaignsQueryDto {
    @ApiPropertyOptional({
        default: 12,
    })
    limit: number;

    @ApiPropertyOptional({
        default: 1,
        description: 'Page number (starts from 1)',
    })
    page: number;
}


// ------------ RESPONSES --------------


// dto for returning one proposal campaign with 1 option
export class ProposalCampaignWithOptionDto extends BaseProposalCampaignDto {
    @ApiProperty({type: BaseProposalCampaignOptionDto})
    @Type(() => BaseProposalCampaignOptionDto)
    @ValidateNested()
    selectedOption: BaseProposalCampaignOptionDto;
}

export class ProposalCampaignsListItemDto implements ProposalCampaignsListItem {
    @ApiProperty({
        example: '65fabc123',
        description: 'Id of campaign creator',
    })
    clientId: string;

    @ApiProperty({
        example: 'John',
        description: 'First name of campaign creator',
    })
    clientName: string;

    @ApiProperty({
        example: '662abc456def',
        description: 'Campaign id',
    })
    campaignId: string;

    @ApiProperty({
        example: 'Instagram Promo Campaign',
        description: 'Campaign name',
    })
    campaignName: string;

    @ApiProperty({
        enum: [...Object.values(SocialMediaEnum), 'multipromo'],
        example: SocialMediaEnum.instagram,
        description: 'Social media platform or multipromo campaign',
    })
    socialMedia: SocialMediaEnum | 'multipromo';

    @ApiProperty({
        example: 125000,
        description: 'Total followers count across selected social accounts',
    })
    totalFollowers: number;

    @ApiProperty({
        example: 500,
        description: 'Private campaign price',
    })
    price: number;

    @ApiProperty({
        example: 700,
        description: 'Public campaign price',
    })
    publicPrice: number;

    @ApiProperty({
        description: 'Date when campaign was created',
        example: 'dd.mm.yy',
    })
    creationDate: string;

    @ApiProperty({
        example: 'active',
        description: 'Current campaign status',
    })
    campaignStatus: string;
}

export class ProposalCampaignsListDto {
    @ApiProperty({ type: () => [ProposalCampaignsListItemDto] })
    campaigns: ProposalCampaignsListItemDto[];
}

// export class UpdateProposalCampaignDto {
//     @ApiProperty({ required: true })
//     campaignId: string;
//
//     @ApiProperty({ required: false })
//     clientId: string;
//
//     @ApiProperty({ required: true })
//     campaignName: string;
//
//     @ApiProperty({ required: false })
//     addedAccounts: selectInfluencersType[];
//
//     @ApiProperty({ required: false })
//     campaignContent: campaignContentItemType[];
//
//     @ApiProperty({ required: false, default: 0 })
//     publicPrice: number;
//
//     @ApiProperty({ required: false, default: 0 })
//     price: number;
//
//     @ApiProperty({ required: false, default: 0 })
//     totalFollowers: number;
//
//     @ApiProperty({ required: true })
//     socialMedia: string;
//
//     @ApiProperty({ required: false, default: [] })
//     hiddenColumns: string[];
// }

// dto for returning just created proposal campaign
export class CreatedProposalCampaignIdDto {
    @ApiProperty({example: '6659bd485bc4317ed7c73555'})
    campaignId: string;
}