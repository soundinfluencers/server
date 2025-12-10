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
}

export class UnauthorizedResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 401 })
    statusCode: number;
}

export class ForbiddenResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 403 })
    statusCode: number;
}

export class NotFoundResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 404 })
    statusCode: number;
}

export class ConflictResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 409 })
    statusCode: number;
}

export class InternalServerErrorResponseDto extends ErrorResponseDto {
    @ApiProperty({ example: 500 })
    statusCode: number;
}