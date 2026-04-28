import { Module } from '@nestjs/common';
import { InternalAgentsController } from './internal-agents.controller';
import { InternalAgentsService } from './internal-agents.service';
import { AgentKeyGuard } from './agent-key.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { VoltAgentModule } from '../../services/agents/voltagent.module';

@Module({
  imports: [PrismaModule, VoltAgentModule],
  controllers: [InternalAgentsController],
  providers: [InternalAgentsService, AgentKeyGuard],
})
export class InternalAgentsModule {}
