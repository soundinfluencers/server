import type { Response } from 'express';

export function setRefreshTokenCookie(res: Response, token: string) {
    const secure = process.env.COOKIE_SECURE === 'true';
    const domain = process.env.COOKIE_DOMAIN;

    res.cookie('refreshToken', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
        secure,
        sameSite: secure ? 'none' : 'lax',
        ...(domain ? { domain } : {}),
    });
}
