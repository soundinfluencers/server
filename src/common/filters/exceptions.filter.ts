import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        let errorResponse: any = {
            statusCode: status,
            message: 'Internal server error',
        };

        if (exception instanceof HttpException) {
            const res = exception.getResponse();

            if (typeof res === 'object') {
                errorResponse = {
                    statusCode: status,
                    ...(res as object),
                };
            } else {
                errorResponse.message = res;
            }
        }

        if (exception instanceof Error) {
            this.logger.error(exception.message, exception.stack);
        } else {
            this.logger.error(exception);
        }

        response.status(status).json(errorResponse);
    }
}
