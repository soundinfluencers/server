import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {ProposalCampaignsListItem} from "../types/proposal-system.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

// TODO: add class validator
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