// DTO with available fields for update client's admin meta information
import {ApiPropertyOptional} from "@nestjs/swagger";
import {IsBoolean, IsOptional, IsString} from "class-validator";

export class AdminUpdateClientDto {
    @ApiPropertyOptional({ type: Boolean })
    @IsBoolean()
    @IsOptional()
    isProposalClient?: boolean;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    internalNote?: boolean;
}