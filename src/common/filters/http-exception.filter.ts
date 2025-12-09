import {
    Catch,
    ExceptionFilter,
    ArgumentsHost,
} from '@nestjs/common';
import { Response } from 'express';
import { HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status = exception.getStatus();
        const errorResponse: any = exception.getResponse();

        response.status(status).json({
            statusCode: status,
            message: errorResponse.message || exception.message,
            error: errorResponse.error || null,
        });
    }
}
