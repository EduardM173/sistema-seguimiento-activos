import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ActivosService, registerWithConsul, deregisterFromConsul } from '@activos/config';
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
    exposedHeaders: ['Content-Disposition'],
  });

  const port = parseInt(process.env.REPORTS_PORT ?? '3002', 10);
  await app.listen(port);
  console.log(`Reports service corriendo en http://localhost:${port}`);

  const instanceId = await registerWithConsul({
    service: ActivosService.REPORTS,
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
