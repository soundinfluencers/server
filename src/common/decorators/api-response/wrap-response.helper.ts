import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export function WrapResponse<TModel>(model: Type<TModel>, statusCode: number) {
    class ResponseWrapper {
        @ApiProperty({ example: statusCode })
        statusCode: number;

        @ApiProperty({ example: 'Success' })
        message?: string;

        @ApiProperty({ type: model })
        data: TModel;
    }

    return ResponseWrapper;
}

export function WrapArrayResponse<TModel>(model: Type<TModel>, statusCode: number) {
    class ResponseWrapper {
        @ApiProperty({ example: statusCode })
        statusCode: number;

        @ApiProperty({ example: 'Success' })
        message?: string;

        @ApiProperty({ type: model, isArray: true })
        data: TModel[];
    }

    return ResponseWrapper;
}
