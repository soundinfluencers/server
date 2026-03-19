import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {ProposalCampaignsListItem} from "../types/proposal-system.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested
} from "class-validator";
import {Type} from "class-transformer";
import {CampaignAccountDto, DetailedCampaignContentItemDto} from "../../campaigns/dto/get-campaigns.dto";

// ------------ BASE TYPES --------------


// base proposal campaign option dto
export class BaseProposalCampaignOptionDto {
    @ApiProperty({type: Number})
    @Type(() => Number)
    @IsNumber()
    optionIndex: number;

    @ApiProperty({type: Number})
    @Type(() => Number)
    @IsNumber()
    price: number;

    @ApiProperty({type: CampaignAccountDto, isArray: true})
    @IsArray()
    @IsNotEmpty()
    @ValidateNested()
    addedAccounts: CampaignAccountDto[];

    @ApiProperty({type: DetailedCampaignContentItemDto, isArray: true})
    @IsArray()
    @IsNotEmpty()
    @ValidateNested()
    campaignContent: DetailedCampaignContentItemDto[];

    @ApiProperty({type: Boolean})
    canEdit: boolean;
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

    @ApiProperty({type: String, enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    @IsEnum([...Object.values(SocialMediaEnum), 'multipromo'])
    socialMedia: SocialMediaEnum | 'multipromo';

    @ApiProperty({type: Number, isArray: true})
    @IsArray()
    @IsNotEmpty()
    existingOptions: number[];
}


// ------------ REQUESTS --------------


// dto for requesting one proposal campaign (with 1 selected option)
export class GetProposalCampaignDto {
    @ApiProperty({required: true})
    @IsString()
    campaignId: string;

    @ApiProperty({required: false, default: 0})
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    optionIndex: number;
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