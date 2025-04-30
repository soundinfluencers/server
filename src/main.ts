import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {SwaggerModule, DocumentBuilder} from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors({
        origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.0.105:3000', 'http://192.168.0.105:3001', 'https://api.soundinfluencers.com', 'https://nazar.soundinfluencers.com', 'https://music-front-alpha.vercel.app', 'https://go.soundinfluencers.com'],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type, Authorization',
    });
    const config = new DocumentBuilder()
        .setTitle('Musics example')
        .setDescription('The music API description')
        .setVersion('1.0')
        .addTag('music')
        // .addServer('https://api.soundinfluencers.com') // Добавление базового URL
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
    // SwaggerModule.setup('api-nazar', app, document);
    await app.listen(3001);
}

bootstrap();
