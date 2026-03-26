import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { AssetsModule } from './assets/assets.module';
import { CatalogsModule } from './catalogs/catalogs.module';

@Module({
  imports: [PrismaModule, AuthModule, AssetsModule, CatalogsModule],
})
export class AppModule {}