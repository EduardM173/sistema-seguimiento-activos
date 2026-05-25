import { Module } from '@nestjs/common';
import { MaterialController } from './material.controller';
import { MaterialService } from './material.service';
import { PrismaModule } from '../common/prisma.module';
import { AgentSyncModule } from '../agent-sync/agent-sync.module';

@Module({
  imports: [PrismaModule, AgentSyncModule],
  controllers: [MaterialController],
  providers: [MaterialService],
  exports: [MaterialService],
})
export class MaterialModule {}
