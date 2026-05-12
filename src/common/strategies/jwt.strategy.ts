import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthSessionRepository } from '../../database/repositories/auth/auth-session.repository';
import { Role, UserPayload } from '../types/user.types';

type AccessTokenPayload = {
    sub?: string;
    sid?: string;
    _id?: string;
    role?: Role;
    email?: string;
    isProposalClient?: boolean;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly authSessionRepo: AuthSessionRepository) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET,
        });
    }

    async validate(payload: AccessTokenPayload): Promise<UserPayload> {
        const userId = payload.sub ?? payload._id;
        const sessionId = payload.sid;

        if (!userId || !sessionId || !payload.role) {
            throw new UnauthorizedException('Invalid token payload');
        }

        const session = await this.authSessionRepo.findActiveForUser(sessionId, userId, payload.role);

        if (!session) {
            throw new UnauthorizedException('Session is not active');
        }

        return {
            _id: userId,
            userId,
            sub: userId,
            sid: sessionId,
            sessionId,
            role: payload.role,
            email: payload.email,
            ...(typeof payload.isProposalClient === 'boolean'
                ? {isProposalClient: payload.isProposalClient}
                : {}),
        };
    }
}
