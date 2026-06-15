import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

type RequestWithUser = Request & {
    user?: {
        _id?: unknown;
        role?: string;
        email?: string;
    };
    requestId?: string;
};

@Injectable()
export class HttpRequestLoggerInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HttpRequest');

    private readonly ignoredPaths = [
        '/health',
        '/favicon.ico',
    ];

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const http = context.switchToHttp();
        const req = http.getRequest<RequestWithUser>();
        const res = http.getResponse<Response>();

        const startedAt = Date.now();

        const requestId = this.getOrCreateRequestId(req);
        req.requestId = requestId;
        res.setHeader('x-request-id', requestId);

        const method = req.method;
        const url = req.originalUrl ?? req.url;

        if (this.shouldIgnore(url, method)) {
            return next.handle();
        }

        return next.handle().pipe(
            tap(() => {
                const durationMs = Date.now() - startedAt;

                this.logger.log({
                    message: 'HTTP request completed',
                    requestId,
                    method,
                    url,
                    statusCode: res.statusCode,
                    durationMs,
                    userId: this.toStringSafe(req.user?._id),
                    role: req.user?.role,
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                });
            }),

            catchError((error) => {
                const durationMs = Date.now() - startedAt;
                const statusCode = this.getErrorStatusCode(error);

                this.logger.error(
                    {
                        message: 'HTTP request failed',
                        requestId,
                        method,
                        url,
                        statusCode,
                        durationMs,
                        userId: this.toStringSafe(req.user?._id),
                        role: req.user?.role,
                        ip: req.ip,
                        userAgent: req.get('user-agent'),
                        errorName: error?.name,
                        errorMessage: error?.message,
                    },
                    error?.stack,
                );

                return throwError(() => error);
            }),
        );
    }

    private getOrCreateRequestId(req: Request): string {
        const header = req.headers['x-request-id'];

        if (Array.isArray(header)) {
            return header[0] || randomUUID();
        }

        if (typeof header === 'string' && header.trim()) {
            return header;
        }

        return randomUUID();
    }

    private shouldIgnore(url: string, method: string): boolean {
        if (method === 'OPTIONS') {
            return true;
        }

        return this.ignoredPaths.some((path) => url.startsWith(path));
    }

    private getErrorStatusCode(error: unknown): number {
        if (
            error &&
            typeof error === 'object' &&
            'getStatus' in error &&
            typeof error.getStatus === 'function'
        ) {
            return error.getStatus();
        }

        return 500;
    }

    private toStringSafe(value: unknown): string | undefined {
        if (!value) {
            return undefined;
        }

        if (typeof value === 'string') {
            return value;
        }

        if (
            typeof value === 'object' &&
            value !== null &&
            'toString' in value &&
            typeof value.toString === 'function'
        ) {
            return value.toString();
        }

        return String(value);
    }
}