import {IsNotEmpty, IsOptional, IsString} from "class-validator";

export class CheckIfInCampaignDto {
    @IsOptional()
    actionId: string | null;

    @IsString()
    @IsNotEmpty()
    networkUsername: string;

    @IsString()
    @IsNotEmpty()
    socialMedia: string;

    @IsString()
    @IsNotEmpty()
    influencerId: string;

    @IsString()
    @IsNotEmpty()
    campaignId: string;

    @IsString()
    @IsNotEmpty()
    campaignName: string;
}