import { ApiProperty } from '@nestjs/swagger';
import {
    CampaignStatusEnum,
    CampaignStatusType,
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

    @ApiProperty()
    creationDate: string;

    @ApiProperty()
    price: number;

    @ApiProperty({ enum: CampaignStatusEnum })
    status: CampaignStatusType;
}

export class ClientGetCampaignsListDto {
    @ApiProperty({ type: () => [ClientGetCampaignForListDto] })
    campaigns?: ClientGetCampaignForList[];
}
