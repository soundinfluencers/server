import {UpdateSocialAccountDto} from "../../../profile/dto/influencer/update-influencer.dto";
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {IsBoolean, IsOptional, IsString} from "class-validator";

// DTO for updating one social account as admin
export class AdminUpdateSocialAccountDto extends UpdateSocialAccountDto {
    @ApiProperty({type: String, description: "influencer id"})
    @IsString()
    influencerId: string;

    @ApiPropertyOptional({type: Boolean, description: "Hidden flag"})
    @IsOptional()
    @IsBoolean()
    isHidden?: boolean;

    // @ApiPropertyOptional({ description: "Deleted flag" })
    // @IsOptional()
    // @IsBoolean()
    // isDeleted?: boolean;
    //
    // @ApiPropertyOptional({ description: "Verified flag" })
    // @IsOptional()
    // @IsBoolean()
    // isVerified?: boolean;
}