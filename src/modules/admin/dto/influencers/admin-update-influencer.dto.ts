import {
    UpdateInfluencerPersonalDto,
    UpdateSocialAccountDto
} from "../../../profile/dto/influencer/update-influencer.dto";
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {IsBoolean, IsNumber, IsOptional, IsString} from "class-validator";
import {Type} from "class-transformer";

// DTO for updating one social account as admin
export class AdminUpdateSocialAccountDto extends UpdateSocialAccountDto {
    @ApiProperty({type: String, description: "influencer id"})
    @IsString()
    influencerId: string;

    @ApiPropertyOptional({type: String, description: "Public Price"})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    publicPrice?: number;

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

// DTO for updating influencer's personal information as admin
export class AdminUpdateInfluencerPersonalDto extends UpdateInfluencerPersonalDto {
    @ApiPropertyOptional({type: String, description: "Internal note"})
    @IsOptional()
    @IsString()
    internalNote?: string;

    @ApiPropertyOptional({type: Number, description: "Balance"})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    balance?: number;
}