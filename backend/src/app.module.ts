import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { MaterialModule } from './material/material.module';
import { UsersModule } from './users/users.module';
import { AssetsModule } from './assets/assets.module';

@Module({
  imports: [PrismaModule, AuthModule, MaterialModule, UsersModule, AssetsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}