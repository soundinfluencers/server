import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
    CampaignStatusEnum,
    CampaignTypeEnumForDevelopment,
    ClientCampaignForTable,
    ClientGetCampaignForList,
    SafeCampaignContent,
    SafeSelectedContent
} from "../../../common/types/client/campaign.types";
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";

export class ClientGetDashboardCampaignsQueryDto {
    @ApiPropertyOptional({
        description: 'Type of campaigns returned',
        enum: CampaignTypeEnumForDevelopment,
        default: CampaignTypeEnumForDevelopment.all
    })
    status: CampaignTypeEnumForDevelopment;

    @ApiPropertyOptional({
        default: 12,
    })
    limit: number;

    @ApiPropertyOptional({
        default: 1,
        description: 'Page number (starts from 1)',
    })
    page: number;

    clientId: string;
}

export class ClientGetCampaignForListDto implements ClientGetCampaignForList {
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
}

export class ClientGetCampaignsDto {
    @ApiProperty({type: () => [ClientGetCampaignForListDto]})
    campaigns?: ClientGetCampaignForList[];
}

export class ClientCampaignForTableDto implements ClientCampaignForTable {
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

    // TODO: implement interface for this
    @ApiProperty()
    addedAccounts: any[];

    @ApiProperty({type: SafeCampaignContent, isArray: true})
    campaignContent: SafeCampaignContent[];

    @ApiProperty()
    shareLink: string;

    @ApiProperty()
    totalFollowers: number;

    @ApiProperty()
    totalImpressions: number;

    @ApiProperty()
    totalLikes: number;

    @ApiProperty()
    totalSaves: number;

    @ApiProperty()
    totalComments: number;

    @ApiProperty()
    totalShares: number;

    // @ApiProperty()
    // isClosed: boolean;

    @ApiProperty()
    isCpmAndResultHidden: boolean;

    @ApiProperty()
    isPriceHidden: boolean;

    @ApiPropertyOptional()
    hiddenColumns?: string[];
}

export class DetailedDraftCampaignAccountDto {
    @ApiProperty()
    _id: string;

    @ApiProperty()
    influencerId: string;

    @ApiProperty()
    accountId: string;

    @ApiProperty()
    socialMedia: SocialMediaEnum;

    @ApiProperty({type: SafeSelectedContent})
    selectedContent: SafeSelectedContent;
}

export class DetailedDraftCampaignDto {
    @ApiProperty()
    _id: string;

    @ApiProperty()
    campaignName: string;

    @ApiProperty({enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    socialMedia: SocialMediaType | 'multipromo';

    @ApiProperty({type: DetailedDraftCampaignAccountDto, isArray: true})
    addedAccounts: DetailedDraftCampaignAccountDto[];

    @ApiProperty({type: SafeCampaignContent, isArray: true})
    campaignContent: SafeCampaignContent[];
}