import { applyDecorators, Type } from '@nestjs/common';
import {
    ApiOkResponse,
    ApiCreatedResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiConflictResponse,
} from '@nestjs/swagger';
import { WrapResponse, WrapArrayResponse } from './wrap-response.helper';
import {
    BadRequestResponseDto, ConflictResponseDto,
    ForbiddenResponseDto, InternalServerErrorResponseDto, NotFoundResponseDto,
    UnauthorizedResponseDto
} from "../../dto/responses/error-response.dto";

export function ApiResponseDto<T>(
    model?: Type<T>,
    options?: { successStatusCode?: 200 | 201; isArray?: boolean }
) {
    const status = options?.successStatusCode ?? 200;

    const responseType = model
        ? (options?.isArray
            ? WrapArrayResponse(model, status)
            : WrapResponse(model, status))
        : undefined;

    const successDecorator =
        status === 201
            ? ApiCreatedResponse({ type: responseType })
            : ApiOkResponse({ type: responseType });

    return applyDecorators(
        successDecorator,
        ApiBadRequestResponse({ type: BadRequestResponseDto }),
        ApiUnauthorizedResponse({ type: UnauthorizedResponseDto }),
        ApiForbiddenResponse({ type: ForbiddenResponseDto }),
        ApiNotFoundResponse({ type: NotFoundResponseDto }),
        ApiConflictResponse({ type: ConflictResponseDto }),
        ApiInternalServerErrorResponse({ type: InternalServerErrorResponseDto }),
    );
}