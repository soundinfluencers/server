import { ConsoleLogger } from '@nestjs/common';

export class FilteredNestLogger extends ConsoleLogger {
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

        super.log(message, ...optionalParams);
    }

    private getContext(optionalParams: unknown[]): string | undefined {
        const lastParam = optionalParams[optionalParams.length - 1];

        if (typeof lastParam === 'string') {
            return lastParam;
        }

        return undefined;
    }
}