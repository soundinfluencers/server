import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../types/user.types';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeReflector(overrides: {
    isPublic?: boolean;
    roles?: Role[] | null;
} = {}): Reflector {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === IS_PUBLIC_KEY) return overrides.isPublic ?? false;
        if (key === ROLES_KEY) return overrides.roles ?? undefined;
        return undefined;
    });
    return reflector;
}

function makeContext(user?: { role?: Role }): ExecutionContext {
    return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
            getRequest: () => ({ user }),
        }),
    } as unknown as ExecutionContext;
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
    describe('public routes', () => {
        it('returns true for any public route regardless of user or roles', () => {
            const guard = new RolesGuard(makeReflector({ isPublic: true, roles: [Role.admin] }));
            const ctx = makeContext(undefined); // no user at all

            expect(guard.canActivate(ctx)).toBe(true);
        });
    });

    describe('routes with no @Roles() decorator', () => {
        it('returns true when no roles are required (only authentication matters)', () => {
            const guard = new RolesGuard(makeReflector({ isPublic: false, roles: undefined }));
            const ctx = makeContext({ role: Role.client });

            expect(guard.canActivate(ctx)).toBe(true);
        });

        it('returns true even with empty roles array', () => {
            const guard = new RolesGuard(makeReflector({ isPublic: false, roles: [] }));
            const ctx = makeContext({ role: Role.client });

            expect(guard.canActivate(ctx)).toBe(true);
        });
    });

    describe('routes protected with @Roles()', () => {
        it('throws ForbiddenException when request has no user', () => {
            const guard = new RolesGuard(makeReflector({ roles: [Role.admin] }));
            const ctx = makeContext(undefined);

            expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
        });

        it('throws ForbiddenException when user has no role property', () => {
            const guard = new RolesGuard(makeReflector({ roles: [Role.admin] }));
            const ctx = makeContext({} as any);

            expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
        });

        it('throws ForbiddenException when user role is not in the required list', () => {
            const guard = new RolesGuard(makeReflector({ roles: [Role.admin] }));
            const ctx = makeContext({ role: Role.client });

            expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
        });

        it('returns true when user role matches the single required role', () => {
            const guard = new RolesGuard(makeReflector({ roles: [Role.admin] }));
            const ctx = makeContext({ role: Role.admin });

            expect(guard.canActivate(ctx)).toBe(true);
        });

        it('returns true when user role is among multiple required roles', () => {
            const guard = new RolesGuard(makeReflector({ roles: [Role.admin, Role.client] }));
            const ctx = makeContext({ role: Role.client });

            expect(guard.canActivate(ctx)).toBe(true);
        });

        it('throws ForbiddenException when user role is influencer but only client is allowed', () => {
            const guard = new RolesGuard(makeReflector({ roles: [Role.client] }));
            const ctx = makeContext({ role: Role.influencer });

            expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
        });
    });

    describe('ForbiddenException messages', () => {
        it('includes "Role required" when user has no role', () => {
            const guard = new RolesGuard(makeReflector({ roles: [Role.admin] }));
            const ctx = makeContext(undefined);

            expect(() => guard.canActivate(ctx)).toThrow(/Role required/i);
        });

        it('includes "Not enough access" when user role does not match', () => {
            const guard = new RolesGuard(makeReflector({ roles: [Role.admin] }));
            const ctx = makeContext({ role: Role.client });

            expect(() => guard.canActivate(ctx)).toThrow(/Not enough access/i);
        });
    });
});
