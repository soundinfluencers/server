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

export class UpdateProposalCampaignDto {
    @ApiProperty({ required: true })
    campaignId: string;

    @ApiProperty({ required: false })
    clientId: string;

    @ApiProperty({ required: true })
    campaignName: string;

    @ApiProperty({ required: false })
    addedAccounts: selectInfluencersType[];

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

// dto for returning just created proposal campaign
export class CreatedProposalCampaignIdDto {
    @ApiProperty({example: '6659bd485bc4317ed7c73555'})
    campaignId: string;
}