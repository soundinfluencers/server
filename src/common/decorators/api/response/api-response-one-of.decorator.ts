import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { BadRequestResponseDto, ConflictResponseDto, ForbiddenResponseDto, InternalServerErrorResponseDto, NotFoundResponseDto, UnauthorizedResponseDto } from '../../../dto/responses/error-response.dto';
import { ApiBadRequestResponse, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiConflictResponse } from '@nestjs/swagger';

export function ApiResponseDtoOneOf(
    models: Type<any>[],
    options?: { successStatusCode?: 200 | 201 }
) {
    const status = options?.successStatusCode ?? 200;

    return applyDecorators(
        ApiExtraModels(...models),
        ApiOkResponse({
            schema: {
                type: 'object',
                properties: {
                    statusCode: { type: 'number', example: status },
                    message: { type: 'string', example: 'Success' },
                    data: {
                        oneOf: models.map((m) => ({ $ref: getSchemaPath(m) })),
                    },
                },
            },
        }),
        ApiBadRequestResponse({ type: BadRequestResponseDto }),
        ApiUnauthorizedResponse({ type: UnauthorizedResponseDto }),
        ApiForbiddenResponse({ type: ForbiddenResponseDto }),
        ApiNotFoundResponse({ type: NotFoundResponseDto }),
        ApiConflictResponse({ type: ConflictResponseDto }),
        ApiInternalServerErrorResponse({ type: InternalServerErrorResponseDto }),
    );
}
