import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
    @ApiProperty()
    statusCode: number;

    @ApiProperty()
    message: string;

    @ApiProperty()
    error: string;
}

export class BadRequestResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 400 })
    statusCode: number;

    @ApiProperty({ example: "Bad Request" })
    message: string;
}

export class UnauthorizedResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 401 })
    statusCode: number;

    @ApiProperty({ example: "Unauthorized" })
    message: string;
}

export class ForbiddenResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 403 })
    statusCode: number;

    @ApiProperty({ example: "Forbidden" })
    message: string;
}

export class NotFoundResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 404 })
    statusCode: number;

    @ApiProperty({ example: "Not Found" })
    message: string;
}

export class ConflictResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 409 })
    statusCode: number;

    @ApiProperty({ example: "Conflict" })
    message: string;
}

export class InternalServerErrorResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 500 })
    statusCode: number;

    @ApiProperty({ example: "Internal Server Error" })
    message: string;
}