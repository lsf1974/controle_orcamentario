import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: config.get('app.FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Financial Control API')
    .setDescription('Sistema de Controle Financeiro Multi-usuário')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('app.PORT') ?? 3001;
  await app.listen(port);
  console.log(`Backend rodando em http://localhost:${port}`);
  console.log(`Swagger em http://localhost:${port}/api/docs`);
}
bootstrap();
