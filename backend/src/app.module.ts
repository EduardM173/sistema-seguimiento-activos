import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { UsersModule } from './users/users.module';
import { AssetsModule } from './assets/assets.module';
import { RolesModule } from './roles/roles.module'; // <-- Añadido

@Module({
  imports: [
    PrismaModule, 
    AuthModule, 
    UsersModule, 
    AssetsModule, 
    RolesModule // <-- Añadido
  ],
})
export class AppModule {}