import { ApiProperty } from "@nestjs/swagger";
import {
    IsArray,
    IsEmail,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    ValidateNested,
    Min,
    Max,
    IsPhoneNumber,
    ArrayNotEmpty,
    IsNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";

export class CountryObj {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    country: string;

    @ApiProperty()
    @IsNumber()
    percentage: number;
}

class Account {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    email: string;

    phone: string;

    @ApiProperty()
    @IsString()
    firstName: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    link: string;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    price: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    followersNumber: number;

    engagementRate: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    averageViews: number;

    @ApiProperty({ type: [CountryObj] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CountryObj)
    countries: CountryObj[];

    @ApiProperty({ type: [String], required: false })
    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    creatorCategories?: string[];
}

export class AdminImportXlsxInfluencersDto {
    @ApiProperty({ type: [Account] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Account)
    influencers: Account[];
}
