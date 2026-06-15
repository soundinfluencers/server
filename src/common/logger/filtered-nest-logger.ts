import { ConsoleLogger, LogLevel } from '@nestjs/common';

type AppLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'verbose';

type JsonLog = {
    level: AppLogLevel;
    time: string;
    service: string;
    env: string;
    context?: string;
    message: string;
    stack?: string;
    data?: unknown;
};

export class FilteredNestLogger extends ConsoleLogger {
    private readonly serviceName = process.env.SERVICE_NAME ?? 'soundinfluencers-backend';
    private readonly env = process.env.NODE_ENV ?? 'unknown';

    private readonly useJsonLogs = process.env.NODE_ENV !== 'local';

    private readonly mutedContexts = new Set([
        'NestFactory',
        'InstanceLoader',
        'RoutesResolver',
        'RouterExplorer',
    ]);

    log(message: unknown, ...optionalParams: unknown[]) {
        const context = this.getContext(optionalParams);

        if (context && this.mutedContexts.has(context)) {
            return;
        }

        if (!this.useJsonLogs) {
            super.log(message, ...optionalParams);
            return;
        }

        this.write('log', message, undefined, context);
    }

    error(message: unknown, stackOrContext?: string, context?: string) {
        if (!this.useJsonLogs) {
            super.error(message, stackOrContext, context);
            return;
        }

        const stack = this.looksLikeStack(stackOrContext) ? stackOrContext : undefined;
        const resolvedContext = context ?? (!stack ? stackOrContext : undefined);

        this.write('error', message, stack, resolvedContext);
    }

    warn(message: unknown, ...optionalParams: unknown[]) {
        if (!this.useJsonLogs) {
            super.warn(message, ...optionalParams);
            return;
        }

        const context = this.getContext(optionalParams);
        this.write('warn', message, undefined, context);
    }

    debug(message: unknown, ...optionalParams: unknown[]) {
        if (!this.useJsonLogs) {
            super.debug(message, ...optionalParams);
            return;
        }

        const context = this.getContext(optionalParams);
        this.write('debug', message, undefined, context);
    }

    verbose(message: unknown, ...optionalParams: unknown[]) {
        if (!this.useJsonLogs) {
            super.verbose(message, ...optionalParams);
            return;
        }

        const context = this.getContext(optionalParams);
        this.write('verbose', message, undefined, context);
    }

    fatal(message: unknown, ...optionalParams: unknown[]) {
        if (!this.useJsonLogs) {
            // ConsoleLogger может не иметь fatal в старых версиях Nest,
            // поэтому fallback через error.
            super.error(message, undefined, this.getContext(optionalParams));
            return;
        }

        const context = this.getContext(optionalParams);
        this.write('fatal', message, undefined, context);
    }

    private write(
        level: LogLevel | 'fatal',
        message: unknown,
        stack?: string,
        context?: string,
    ) {
        const normalized = this.normalizeMessage(message);

        const log: JsonLog = {
            level: this.normalizeLevel(level),
            time: new Date().toISOString(),
            service: this.serviceName,
            env: this.env,
            context,
            message: normalized.message,
            stack: stack ?? normalized.stack,
            data: normalized.data,
        };

        const line = safeStringify(removeUndefinedFields(log));

        if (level === 'error' || level === 'fatal') {
            process.stderr.write(line + '\n');
            return;
        }

        process.stdout.write(line + '\n');
    }

    private normalizeLevel(level: LogLevel | 'fatal'): AppLogLevel {
        if (level === 'log') return 'info';
        return level;
    }

    private normalizeMessage(message: unknown): {
        message: string;
        stack?: string;
        data?: unknown;
    } {
        if (message instanceof Error) {
            return {
                message: message.message,
                stack: message.stack,
                data: {
                    name: message.name,
                },
            };
        }

        if (typeof message === 'string') {
            return {
                message,
            };
        }

        if (isRecord(message)) {
            const messageText =
                typeof message.message === 'string'
                    ? message.message
                    : safeStringify(message);

            return {
                message: messageText,
                data: message,
            };
        }

        return {
            message: safeStringify(message),
            data: message,
        };
    }

    private getContext(optionalParams: unknown[]): string | undefined {
        const lastParam = optionalParams[optionalParams.length - 1];

        if (typeof lastParam === 'string') {
            return lastParam;
        }

        return undefined;
    }

    private looksLikeStack(value?: string): boolean {
        if (!value) return false;

        return value.includes('\n') || value.includes('Error:') || value.includes('Exception');
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return '[Unserializable value]';
    }
}

function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
}