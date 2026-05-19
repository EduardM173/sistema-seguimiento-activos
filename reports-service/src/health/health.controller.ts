import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'reports-service',
      message: 'Microservicio de Reportes y Exportacion disponible',
      timestamp: new Date().toISOString(),
    };
  }
}
