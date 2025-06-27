import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://192.168.0.105:3000',
      'http://192.168.0.105:3001',
      // 'https://api.soundinfluencers.com',
      'https://nazar.soundinfluencers.com',
      'https://go.soundinfluencers.com',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  });

  app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('SoundInfluencers')
    .setDescription('API description')
    .setVersion('2.0')
    .addTag('music')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  // SwaggerModule.setup('api-nazar', app, document);
  await app.listen(3001);
}

bootstrap();
