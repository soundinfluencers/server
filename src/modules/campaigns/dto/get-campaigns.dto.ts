import { ApiProperty } from '@nestjs/swagger';
import {
    CampaignStatusEnum,
    CampaignStatusType, ClientCampaignForTable,
    ClientGetCampaignForList
} from "../../../common/types/client/campaign.types";
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";

export class ClientGetCampaignForListDto implements ClientGetCampaignForList {
    @ApiProperty()
    _id: string;

    @ApiProperty()
    campaignName: string;

    @ApiProperty({ enum: [...Object.values(SocialMediaEnum), 'multipromo'] })
    socialMedia: SocialMediaType | 'multipromo';

    @ApiProperty({ type: String, format: 'date-time' })
    creationDate: string;

    @ApiProperty()
    price: number;

    @ApiProperty({ enum: CampaignStatusEnum })
    status: CampaignStatusType;
}

export class ClientGetCampaignsDto {
    @ApiProperty({ type: () => [ClientGetCampaignForListDto] })
    campaigns?: ClientGetCampaignForList[];
}

export class ClientCampaignForTableDto implements ClientCampaignForTable {
    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    campaignName: string;

    @ApiProperty({ enum: [...Object.values(SocialMediaEnum), 'multipromo'] })
    socialMedia: SocialMediaType | 'multipromo';

    @ApiProperty({ type: String, example: '12.12.25' })
    creationDate: string;

    @ApiProperty()
    price: number;

    @ApiProperty({ enum: CampaignStatusEnum })
    status: CampaignStatusType;

    // TODO: implement interface for this
    @ApiProperty()
    addedAccounts: any[];

    // TODO: implement interface for this
    @ApiProperty()
    campaignContent: any[];

    @ApiProperty()
    shareLink: string;

    @ApiProperty()
    totalFollowers: number;

    @ApiProperty()
    totalLikes: number;

    @ApiProperty()
    totalImpressions: number;

    @ApiProperty()
    isClosed: boolean;

    @ApiProperty()
    isCpmAndResultHidden: boolean;

    @ApiProperty()
    isPriceHidden: boolean;

    @ApiProperty()
    hiddenColumns: string[];
}

