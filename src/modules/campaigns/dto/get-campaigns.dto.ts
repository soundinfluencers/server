import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
    CampaignDraftLatestStep,
    CampaignStatusEnum,
    CampaignTypeEnumForDevelopment,
} from "../../../common/types/client/campaign.types";
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";
import {
    CampaignContentItemDto,
    DraftCampaignNewAccountDto,
    SelectedCampaignContentItemDto
} from "./create-campaign.dto";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../../common/types/influencer/promo.types";
import {CampaignContentMediaCache} from "../../../database/schemas/campaign/campaign.schema";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";

export class ClientGetDashboardCampaignsQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({
        description: 'Type of campaigns returned',
        enum: CampaignTypeEnumForDevelopment,
        default: CampaignTypeEnumForDevelopment.all
    })
    status: CampaignTypeEnumForDevelopment;

    clientId: string;
}

export class DashboardCampaignDto {
    @ApiProperty()
    _id: string;

    @ApiProperty()
    campaignName: string;

    @ApiProperty({enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    socialMedia: SocialMediaType | 'multipromo';

    @ApiProperty({
        description: 'Date when campaign was created',
        example: 'dd.mm.yy',
    })
    creationDate: string;

    @ApiPropertyOptional()
    price?: number;

    @ApiPropertyOptional({enum: CampaignStatusEnum})
    status?: CampaignStatusEnum;

    @ApiPropertyOptional({enum: CampaignDraftLatestStep})
    draftStep?: CampaignDraftLatestStep;
}

export class GetDashboardCampaignsDto {
    @ApiProperty({type: () => [DashboardCampaignDto]})
    campaigns?: DashboardCampaignDto[];
}

// DTO with detailed selected content info
export class DetailedSelectedContentDto {
    @ApiProperty({ type: String })
    _id: string;

    @ApiProperty({ type: String, enum: SocialMediaEnum })
    socialMedia: SocialMediaEnum;

    @ApiProperty({ type: String })
    socialMediaGroup: string;

    @ApiProperty({ type: String })
    mainLink: string;

    @ApiProperty({ type: String })
    description: string;

    @ApiPropertyOptional({ type: String })
    taggedUser?: string;

    @ApiPropertyOptional({ type: String })
    taggedLink?: string;

    @ApiPropertyOptional({ type: String })
    additionalBrief?: string;
}

// DTO with detailed campaign's addedAccounts item
export class CampaignAccountDto {
    @ApiProperty({ type: String })
    addedAccountsId: string;

    @ApiProperty({ type: String })
    socialAccountId: string;

    @ApiProperty({ type: String })
    influencerId: string;

    @ApiProperty({ type: String, enum: SocialMediaEnum })
    socialMedia: SocialMediaEnum;

    @ApiProperty({ type: String })
    username: string;

    @ApiProperty({ type: Number })
    publicPrice: number;

    @ApiProperty({ type: Number })
    followers: number;

    @ApiProperty({ type: SelectedCampaignContentItemDto })
    selectedContent: SelectedCampaignContentItemDto; // item with selected content items _ids

    @ApiPropertyOptional({ type: DetailedSelectedContentDto})
    selectedContentItem?: DetailedSelectedContentDto; // item with detailed selected content info

    @ApiProperty({ type: String, enum: InfluencerConfirmationStatusEnum })
    confirmation: InfluencerConfirmationStatusEnum;

    @ApiProperty({ type: String, enum: InfluencerPromoClosedStatusEnum })
    closePromo: InfluencerPromoClosedStatusEnum;

    @ApiPropertyOptional({ type: String })
    dateRequest?: string;

    // Campaign insights

    @ApiPropertyOptional({ type: String })
    datePost?: string;

    @ApiPropertyOptional({ type: String })
    postLink?: string;

    @ApiPropertyOptional({ type: String })
    screenshot?: string;

    @ApiPropertyOptional({ type: Number })
    impressions?: number;

    @ApiPropertyOptional({ type: Number })
    like?: number;

    @ApiPropertyOptional({ type: Number })
    comments?: number;

    @ApiPropertyOptional({ type: Number })
    shares?: number;

    @ApiPropertyOptional({ type: Number })
    saves?: number;

    @ApiPropertyOptional({ type: Number })
    rating?: number;

    @ApiPropertyOptional({ type: String, isArray: true })
    genres?: string[];

    @ApiPropertyOptional({ type: Object, isArray: true })
    countries?: object[];

    @ApiPropertyOptional({ type: String })
    logoUrl?: string;
}

// DTO with detailed campaign's content item (added mediaCache object)
export class DetailedCampaignContentItemDto extends CampaignContentItemDto {
    @ApiPropertyOptional({ type: CampaignContentMediaCache })
    mediaCache?: CampaignContentMediaCache;
}

// DTO with detailed campaign info
export class CampaignDetailsDto {
    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    campaignName: string;

    @ApiProperty({enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    socialMedia: SocialMediaType | 'multipromo';

    @ApiProperty({type: String, example: '12.12.25'})
    creationDate: string;

    @ApiProperty()
    price: number;

    @ApiProperty({enum: CampaignStatusEnum})
    status: CampaignStatusEnum;

    @ApiProperty({ type: CampaignAccountDto, isArray: true })
    addedAccounts: CampaignAccountDto[];

    @ApiProperty({type: DetailedCampaignContentItemDto, isArray: true})
    campaignContent: DetailedCampaignContentItemDto[];

    @ApiProperty({ type: String })
    shareLink: string;

    @ApiProperty({ type: Number })
    totalFollowers: number;

    @ApiProperty({ type: Number })
    totalImpressions: number;

    @ApiProperty({ type: Number })
    totalLikes: number;

    @ApiProperty({ type: Number })
    totalSaves: number;

    @ApiProperty({ type: Number })
    totalComments: number;

    @ApiProperty({ type: Number })
    totalShares: number;

    @ApiProperty({ type: Boolean })
    isCpmAndResultHidden: boolean;

    @ApiProperty({ type: Boolean })
    isPriceHidden: boolean;

    @ApiPropertyOptional()
    hiddenColumns?: string[];

    @ApiPropertyOptional()
    cpm?: number;

    @ApiPropertyOptional({ type: Boolean })
    canEdit?: boolean;
}

export class DraftCampaignAccountDto extends DraftCampaignNewAccountDto {
    @ApiProperty()
    username: string;

    @ApiProperty()
    logoUrl: string;

    @ApiProperty()
    followers: number;

    @ApiProperty()
    price: number;
}

export class DetailedDraftCampaignDto {
    @ApiProperty()
    _id: string;

    @ApiProperty({enum: CampaignDraftLatestStep})
    step: CampaignDraftLatestStep;

    @ApiProperty({enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    socialMedia: SocialMediaType | 'multipromo';

    @ApiProperty({type: DraftCampaignAccountDto, isArray: true})
    addedAccounts: DraftCampaignAccountDto[];

    @ApiPropertyOptional()
    campaignName?: string;

    @ApiPropertyOptional({type: DetailedCampaignContentItemDto, isArray: true})
    campaignContent?: DetailedCampaignContentItemDto[];

    @ApiProperty()
    totalPrice: number;
}