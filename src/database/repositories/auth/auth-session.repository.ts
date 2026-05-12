import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../../common/types/user.types';
import { AuthSession } from '../../schemas/auth/auth-session.schema';
import { BaseRepository } from '../base.repository';

@Injectable()
export class AuthSessionRepository extends BaseRepository<AuthSession> {
    constructor(
        @InjectModel(AuthSession.name)
        private readonly authSessionModel: Model<AuthSession>,
    ) {
        super(authSessionModel);
    }

    findActiveById(sessionId: string) {
        if (!Types.ObjectId.isValid(sessionId)) {
            return null;
        }

        return this.authSessionModel.findOne({
            _id: new Types.ObjectId(sessionId),
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        }).exec();
    }

    findActiveForUser(sessionId: string, userId: string, role: Role) {
        if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
            return null;
        }

        return this.authSessionModel.findOne({
            _id: new Types.ObjectId(sessionId),
            userId: new Types.ObjectId(userId),
            role,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        }).exec();
    }

    revokeById(sessionId: string) {
        if (!Types.ObjectId.isValid(sessionId)) {
            return null;
        }

        return this.authSessionModel.findByIdAndUpdate(
            sessionId,
            { $set: { revokedAt: new Date() } },
            { new: true },
        ).exec();
    }

    rotateRefreshToken(sessionId: string, refreshTokenHash: string, refreshTokenId: string, expiresAt: Date) {
        if (!Types.ObjectId.isValid(sessionId)) {
            return null;
        }

        return this.authSessionModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(sessionId),
                revokedAt: null,
                expiresAt: { $gt: new Date() },
            },
            {
                $set: {
                    refreshTokenHash,
                    refreshTokenId,
                    expiresAt,
                    lastSeenAt: new Date(),
                },
            },
            { new: true },
        ).exec();
    }

    touchLastSeen(sessionId: string) {
        if (!Types.ObjectId.isValid(sessionId)) {
            return null;
        }

        return this.authSessionModel.updateOne(
            {
                _id: new Types.ObjectId(sessionId),
                revokedAt: null,
                expiresAt: { $gt: new Date() },
            },
            { $set: { lastSeenAt: new Date() } },
        ).exec();
    }
}
