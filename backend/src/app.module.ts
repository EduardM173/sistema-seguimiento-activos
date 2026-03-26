import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { MaterialModule } from './material/material.module';
import { UsersModule } from './users/users.module';
import { AssetsModule } from './assets/assets.module';
import { CatalogsModule } from './catalogs/catalogs.module';

@Module({
  imports: [PrismaModule, AuthModule, MaterialModule, UsersModule, AssetsModule, CatalogsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}