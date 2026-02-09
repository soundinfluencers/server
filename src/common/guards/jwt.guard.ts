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

    canActivate(context: ExecutionContext) {
        const isPublic = this.isPublic(context);

        if (!isPublic) {
            return super.canActivate(context);
        }

        const req = context.switchToHttp().getRequest();
        const authHeader: string | undefined = req.headers?.authorization;

        if (!authHeader) return true;

        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        const isPublic = this.isPublic(context);

        if (isPublic) {
            return user ?? undefined;
        }

        return super.handleRequest(err, user, info, context);
    }
}
