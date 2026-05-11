import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8084',
      'http://localhost:8085',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
  });

  const port = process.env.REPORTS_PORT || 3002;
  await app.listen(port);
  console.log(`Reports service corriendo en http://localhost:${port}`);
}

bootstrap();
