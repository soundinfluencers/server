import type {Response} from 'express';

const secure = process.env.COOKIE_SECURE === 'true';
const domain = process.env.COOKIE_DOMAIN;

export function setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
        secure,
        sameSite: secure ? 'none' : 'lax',
        ...(domain ? {domain} : {}),
    });
}

export function clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        path: '/',
        secure,
        sameSite: secure ? 'none' : 'lax',
        ...(domain ? {domain} : {}),
    });
}