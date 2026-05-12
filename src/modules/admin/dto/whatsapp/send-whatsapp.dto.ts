import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {SocialMediaEnum} from "../../../../common/types/social-media.types";

export class SendWhatsappDto {
    @ApiProperty({ required: true })
    influencerId: string;

    @ApiProperty({ required: true })
    accountId: string;

    @ApiProperty({ required: true, description: "Account's social media" })
    socialMedia: SocialMediaEnum;

    @ApiProperty({ required: true })
    message: string;

    @ApiPropertyOptional({
        description: 'Optional frontend-generated tab correlation key. Do not use as an auth identifier.',
    })
    clientId?: string;

    @ApiProperty({ required: true })
    campaignId: string;
}