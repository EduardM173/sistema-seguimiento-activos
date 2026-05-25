import { Module } from '@nestjs/common';

import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AgentSyncModule } from '../agent-sync/agent-sync.module';

@Module({
  imports: [UploadsModule, AgentSyncModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
