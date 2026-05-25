import { Module } from '@nestjs/common';
import { AgentSyncService } from './agent-sync.service';

@Module({
  providers: [AgentSyncService],
  exports: [AgentSyncService],
})
export class AgentSyncModule {}
