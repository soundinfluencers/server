import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {CreateSocialAccountDto} from "../../auth/dto/create-influencer.dto";

// DTO for updating personal details
export class UpdateInfluencerPersonalDetailsDto {
    _id: string;

    @ApiPropertyOptional({ description: "Influencer's updated first name", example: "Eric" })
    @IsOptional()
    @IsString()
    firstName: string;

    @ApiPropertyOptional({ description: "Influencer's updated email", example: "test@gmail.com" })
    @IsOptional()
    @IsString()
    email: string;

    @ApiPropertyOptional({ description: "Influencer's updated phone number", example: "+999999" })
    @IsOptional()
    @IsString()
    phone: string;
}

// result of updating personal details
export class InfluencerUpdatedPersonalDetailsDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    firstName: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    email: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    phone: string;
}

// DTO for adding new social accounts
export class AddSocialMediasDto {
    @ApiProperty()
    @IsString()
    influencerId: string;

    @ApiProperty({ type: [CreateSocialAccountDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    instagram?: CreateSocialAccountDto[];

    @ApiProperty({ type: [CreateSocialAccountDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    tiktok?: CreateSocialAccountDto[];

    @ApiProperty({ type: [CreateSocialAccountDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    spotify?: CreateSocialAccountDto[];

    @ApiProperty({ type: [CreateSocialAccountDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    soundcloud?: CreateSocialAccountDto[];

    @ApiProperty({ type: [CreateSocialAccountDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    facebook?: CreateSocialAccountDto[];

    @ApiProperty({ type: [CreateSocialAccountDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    youtube?: CreateSocialAccountDto[];

    @ApiProperty({ type: [CreateSocialAccountDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    press?: CreateSocialAccountDto[];
}

// DTO for updating one social account
export class UpdateSocialMediaAccountDto extends CreateSocialAccountDto {
    @ApiProperty()
    @IsString()
    influencerId: string;

    @ApiProperty()
    @IsString()
    typeOfSocialMedia: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    oldUsername?: string;
}
