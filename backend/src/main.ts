import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ActivosService, registerWithConsul, deregisterFromConsul } from '@activos/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8084',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sistema de Seguimiento de Activos API')
    .setDescription('Documentación de endpoints del backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = parseInt(process.env.BACKEND_PORT ?? '3001', 10);
  await app.listen(port);
  console.log(`Backend corriendo en http://localhost:${port}/api`);
  console.log(`Swagger disponible en http://localhost:${port}/docs`);

  const instanceId = await registerWithConsul({
    service: ActivosService.BACKEND,
    port,
  });

  const shutdown = async () => {
    await deregisterFromConsul(instanceId);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

bootstrap();
