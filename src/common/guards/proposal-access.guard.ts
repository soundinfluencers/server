import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest, ClientPayload, Role, UserPayload } from '../types/user.types';
import { PROPOSAL_ACCESS_KEY, ProposalAccessType } from '../decorators/proposal-access.decorator';

function isClientPayload(user: UserPayload): user is ClientPayload {
    return user.role === Role.client;
}

@Injectable()
export class ProposalAccessGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const accessType = this.reflector.getAllAndOverride<ProposalAccessType>(
            PROPOSAL_ACCESS_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!accessType) return true;

        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const user = request.user;

        if (!user) throw new UnauthorizedException('Unauthorized');

        switch (accessType) {
            case 'adminOnly':
                if (user.role === Role.admin) return true;
                throw new ForbiddenException('Forbidden');

            case 'proposalClientOnly':
                if (isClientPayload(user) && user?.isProposalClient === true) return true;
                throw new ForbiddenException('Forbidden');

            case 'adminOrProposalClient':
                if (user.role === Role.admin) return true;
                if (isClientPayload(user) && user?.isProposalClient === true) return true;
                throw new ForbiddenException('Forbidden');

            default:
                throw new ForbiddenException('Forbidden');
        }
    }
}
