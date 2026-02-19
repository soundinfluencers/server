import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler, StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map((data) => {
                if (data instanceof StreamableFile || Buffer.isBuffer(data) || data instanceof Uint8Array) return data;

                return {
                    statusCode: 200,
                    message: 'Success',
                    data,
                };
            }),
        );
    }
}
