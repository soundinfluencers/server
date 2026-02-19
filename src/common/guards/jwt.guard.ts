import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
    constructor(private readonly reflector: Reflector) {
        super();
    }

    private isPublic(context: ExecutionContext) {
        return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
    }

    async canActivate(context: ExecutionContext) {
        await super.canActivate(context);
        return true;
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        const isPublic = this.isPublic(context);

        if (isPublic) {
            return user ?? undefined;
        }

        return super.handleRequest(err, user, info, context);
    }
}