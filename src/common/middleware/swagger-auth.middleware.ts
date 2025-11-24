import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class SwaggerAuthMiddleware implements NestMiddleware {
    use(req: any, res: any, next: () => void) {
        const auth = { login: process.env.SWAGGER_LOGIN, password: process.env.SWAGGER_PASSWORD };

        const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
        const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

        if (login === auth.login && password === auth.password) {
            return next();
        }

        res.set('WWW-Authenticate', 'Basic realm="API Docs"');
        res.status(401).send('Authentication required.');
    }
}
