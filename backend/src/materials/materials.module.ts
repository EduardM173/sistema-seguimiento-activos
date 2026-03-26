import { Module } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';
import { MaterialCategoriesController } from './material-categories.controller';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MaterialsController, MaterialCategoriesController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
