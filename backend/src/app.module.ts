import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { UsersModule } from './users/users.module';
import { AssetsModule } from './assets/assets.module';
import { MaterialsModule } from './materials/materials.module';
import { MaterialModule } from './material/material.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { LocationsModule } from './locations/locations.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    AssetsModule,
    MaterialsModule,
    MaterialModule,
    CatalogsModule,
    LocationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}