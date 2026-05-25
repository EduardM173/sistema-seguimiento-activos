import { Module } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';
import { MaterialCategoriesController } from './material-categories.controller';
import { PrismaModule } from '../common/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AgentSyncModule } from '../agent-sync/agent-sync.module';

@Module({
  imports: [PrismaModule, UploadsModule, AgentSyncModule],
  controllers: [MaterialsController, MaterialCategoriesController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
