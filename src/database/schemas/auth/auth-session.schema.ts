import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../../common/types/user.types';

export type AuthSessionDocument = HydratedDocument<AuthSession>;

@Schema({
    collection: 'auth_sessions',
    timestamps: { createdAt: true, updatedAt: false },
})
export class AuthSession {
    @Prop({ type: Types.ObjectId })
    _id: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId, index: true })
    userId: Types.ObjectId;

    @Prop({ required: true, type: String, enum: Role, index: true })
    role: Role;

    @Prop({ required: true, type: String })
    refreshTokenHash: string;

    @Prop({ required: true, type: String })
    refreshTokenId: string;

    @Prop({ type: Date })
    createdAt: Date;

    @Prop({ required: true, type: Date })
    expiresAt: Date;

    @Prop({ default: null, type: Date, index: true })
    revokedAt: Date | null;

    @Prop({ required: false, type: String })
    userAgent?: string;

    @Prop({ required: false, type: String })
    ipAddress?: string;

    @Prop({ default: null, type: Date })
    lastSeenAt: Date | null;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);

AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthSessionSchema.index({ _id: 1, userId: 1, role: 1, revokedAt: 1, expiresAt: 1 });
