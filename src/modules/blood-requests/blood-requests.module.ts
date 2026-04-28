import { Module } from '@nestjs/common';
import { BloodRequestsController } from './blood-requests.controller';
import { BloodRequestsService } from './blood-requests.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { VoltAgentModule } from '../../services/agents/voltagent.module';

@Module({
  imports: [PrismaModule, VoltAgentModule],
  controllers: [BloodRequestsController],
  providers: [BloodRequestsService],
  exports: [BloodRequestsService],
})
export class BloodRequestsModule {}