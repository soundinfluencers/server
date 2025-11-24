import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import { AppModule } from "./modules/app/app.module";
import {SwaggerAuthMiddleware} from "./common/middleware/swagger-auth.middleware";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.use(cookieParser());
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

    app.enableCors({
        origin: [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:3001',
            'http://192.168.0.105:5173',
            'http://192.168.0.105:3000',
            'http://192.168.0.105:3001',
            'https://nazar.soundinfluencers.com',
            'https://go.soundinfluencers.com',
        ],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
        allowedHeaders: 'Content-Type, Authorization',
    });

    app.use((req, res, next) => {
        res.removeHeader('X-Frame-Options');
        next();
    });

    console.log("ENV:", process.env.NODE_ENV);

    if (process.env.NODE_ENV === 'production') {
        app.use('/api', new SwaggerAuthMiddleware().use);
    }

    const config = new DocumentBuilder()
        .setTitle('Sound Influencers API')
        .setDescription('REST API documentation')
        .setVersion('2.0')

        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT access token',
            },
            'access-token',
        )

        .addCookieAuth(
            'refreshToken',
            {
                type: 'apiKey',
                in: 'cookie',
            }
        )

        .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        }
    });

    await app.listen(3001);
}

bootstrap();
