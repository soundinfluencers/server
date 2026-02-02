import { ApiPropertyOptional } from "@nestjs/swagger";
import {IsOptional, IsString} from "class-validator";

export class UpdateClientPersonalDetailsDto {
    _id: string;

    @ApiPropertyOptional({ description: "Client's updated first name", example: "Eric" })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ description: "Client's updated logo url" })
    @IsOptional()
    @IsString()
    logoUrl?: string;

    @ApiPropertyOptional({ description: "Client's updated company name", example: "NapoleonPR" })
    @IsOptional()
    @IsString()
    company?: string;

    @ApiPropertyOptional({ description: "Client's updated email", example: "test@gmail.com" })
    @IsOptional()
    @IsString()
    email?: string;

    @ApiPropertyOptional({ description: "Client's updated phone number", example: "+9999999" })
    @IsOptional()
    @IsString()
    phone?: string;
}

export class ClientUpdatedPersonalDetailsDto {
    @ApiPropertyOptional({
        description: "Client's updated first name",
        example: "Eric"
    })
    firstName: string;

    @ApiPropertyOptional({
        description: "Client's updated logo url",
    })
    logoUrl: string;

    @ApiPropertyOptional({
        description: "Client's updated company name",
        example: "NapoleonPR"
    })
    company: string;

    @ApiPropertyOptional({
        description: "Client's updated email",
        example: "test@gmail.com"
    })
    email: string;

    @ApiPropertyOptional({
        description: "Client's updated phone number",
        example: "+9999999"
    })
    phone: string;
}