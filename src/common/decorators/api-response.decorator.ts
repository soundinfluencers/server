import { applyDecorators, Type } from '@nestjs/common';
import {
    ApiOkResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
    BadRequestResponseDto,
    UnauthorizedResponseDto,
    ForbiddenResponseDto,
    InternalServerErrorResponseDto,
} from '../dto/error-response.dto';

export function ApiResponseDto<T>(model?: Type<T>) {
    return applyDecorators(
        model ? ApiOkResponse({ type: model }) : ApiOkResponse({ description: 'Success' }),
        ApiBadRequestResponse({ type: BadRequestResponseDto }),
        ApiUnauthorizedResponse({ type: UnauthorizedResponseDto }),
        ApiForbiddenResponse({ type: ForbiddenResponseDto }),
        ApiInternalServerErrorResponse({ type: InternalServerErrorResponseDto }),
    );
}