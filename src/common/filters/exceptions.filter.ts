import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : 500;

        const errorResponse =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Internal server error';

        const message =
            exception instanceof HttpException
                ? (errorResponse as any).message || exception.message
                : 'Internal server error';

        response.status(status).json({
            statusCode: status,
            message,
        });
    }
}
