import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../guards/jwt.guard';

export function Auth(tag?: string) {
    const decorators = [
        ApiBearerAuth('access-token'),
        UseGuards(JwtGuard),
    ];

    if (tag) {
        decorators.push(ApiTags(tag));
    }

    return applyDecorators(...decorators);
}