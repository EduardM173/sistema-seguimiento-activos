import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { AssetsModule } from './assets/assets.module';

@Module({
  imports: [PrismaModule, AuthModule, AssetsModule],
})
export class AppModule {}