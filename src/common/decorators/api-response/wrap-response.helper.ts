import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export function WrapResponse<TModel>(model: Type<TModel>, statusCode: number) {
    const modelName = model.name;
    const className = `${modelName}Response_${statusCode}`;

    class ResponseWrapper {
        @ApiProperty({ example: statusCode })
        statusCode: number;

        @ApiProperty({ example: 'Success' })
        message?: string;

        @ApiProperty({ type: model })
        data: TModel;
    }

    Object.defineProperty(ResponseWrapper, 'name', { value: className });
    return ResponseWrapper;
}

export function WrapArrayResponse<TModel>(model: Type<TModel>, statusCode: number) {
    const modelName = model.name;
    const className = `${modelName}ArrayResponse_${statusCode}`;

    class ResponseWrapper {
        @ApiProperty({ example: statusCode })
        statusCode: number;

        @ApiProperty({ example: 'Success' })
        message?: string;

        @ApiProperty({ type: model, isArray: true })
        data: TModel[];
    }

    Object.defineProperty(ResponseWrapper, 'name', { value: className });
    return ResponseWrapper;
}
