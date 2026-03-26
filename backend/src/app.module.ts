import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { UsersModule } from './users/users.module';
import { AssetsModule } from './assets/assets.module';
import { CatalogsModule } from './catalogs/catalogs.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, AssetsModule, CatalogsModule],
})
export class AppModule {}