import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { MaterialModule } from './material/material.module';

@Module({
  imports: [PrismaModule, AuthModule, MaterialModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}