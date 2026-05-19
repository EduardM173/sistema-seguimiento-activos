import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [DatabaseModule, ReportsModule],
  controllers: [HealthController],
})
export class AppModule {}
