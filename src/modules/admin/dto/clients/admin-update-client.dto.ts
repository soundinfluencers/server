import {ApiPropertyOptional} from "@nestjs/swagger";
import {IsBoolean, IsOptional, IsString} from "class-validator";

// DTO with available fields for update client's admin meta-information
export class AdminUpdateClientDto {
    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    firstName?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    lastName?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    companyType?: string;

    @ApiPropertyOptional({ type: Boolean })
    @IsBoolean()
    @IsOptional()
    isProposalClient?: boolean;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    internalNote?: string;
}