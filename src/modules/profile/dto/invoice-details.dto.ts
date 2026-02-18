import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {IsOptional, IsString} from "class-validator";
import {Role} from "../../../common/types/user.types";

// dto request for updating invoice details
export class UpdateInvoiceDetailsDto {
    userId: string;
    userRole: Role;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    company?: string;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    vatNumber?: string;
}

// dto response of updating invoice details
export class InvoiceDetailsDto {
    @ApiPropertyOptional({type: String})
    firstName?: string;

    @ApiPropertyOptional({type: String})
    lastName?: string;

    @ApiPropertyOptional({type: String})
    address?: string;

    @ApiPropertyOptional({type: String})
    country?: string;

    @ApiPropertyOptional({type: String})
    company?: string;

    @ApiPropertyOptional({type: String})
    vatNumber?: string;
}