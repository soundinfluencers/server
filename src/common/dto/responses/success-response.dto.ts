import { ApiProperty } from "@nestjs/swagger";

export class CreatedResponseDto<T> {
    @ApiProperty({ example: 201, description: 'HTTP status code' })
    statusCode: number;

    @ApiProperty({ example: 'Success', description: "Response message", required: false })
    message?: string;

    @ApiProperty({ required: false, description: 'Response data' })
    data?: T;
}

export class OkResponseDto<T> {
    @ApiProperty({ example: 200, description: 'HTTP status code' })
    statusCode: number;

    @ApiProperty({ example: 'Success', description: "Response message", required: false })
    message?: string;

    @ApiProperty({ required: false, description: 'Response data' })
    data?: T;
}
