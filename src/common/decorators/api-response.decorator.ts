import {applyDecorators, Type} from '@nestjs/common';
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
import {
    BadRequestResponseDto,
    UnauthorizedResponseDto,
    ForbiddenResponseDto,
    InternalServerErrorResponseDto,
    NotFoundResponseDto,
    ConflictResponseDto,
} from '../dto/responses/error-response.dto';
import {CreatedResponseDto, OkResponseDto} from "../dto/responses/success-response.dto";

export function ApiResponseDto<T>(
    model?: Type<T>,
    options?: { successStatusCode?: 200 | 201; isArray?: boolean }
) {
    const successStatusCode = options?.successStatusCode ?? 200;

    const successDecorator =
        successStatusCode === 201
            ? ApiCreatedResponse({
                type: CreatedResponseDto<typeof model>,
                isArray: options?.isArray,
                status: 201
            })
            : ApiOkResponse({
                type: OkResponseDto<typeof model>,
                isArray: options?.isArray,
                status: 200
            });

    return applyDecorators(
        successDecorator,
        ApiBadRequestResponse({type: BadRequestResponseDto}),
        ApiUnauthorizedResponse({type: UnauthorizedResponseDto}),
        ApiForbiddenResponse({type: ForbiddenResponseDto}),
        ApiNotFoundResponse({type: NotFoundResponseDto}),
        ApiConflictResponse({type: ConflictResponseDto}),
        ApiInternalServerErrorResponse({type: InternalServerErrorResponseDto}),
    );
}
