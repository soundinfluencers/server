import { Response } from 'express';

export function setRefreshTokenCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        ...(isProd ? { domain: ".soundinfluencers.com" } : {}),
    });
}
