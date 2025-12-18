import {ApiProperty} from "@nestjs/swagger";
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";

// Request body for migrating social account to another influencer
export class MigrateAccountDto {
    @ApiProperty()
    influencerId: string;

    @ApiProperty()
    socialAccountToMigrateId: string;

    @ApiProperty({ enum: SocialMediaEnum })
    socialMediaOfAccount: SocialMediaType;
}