import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DonorsController } from './donors.controller';
import { DonorsService } from './donors.service';
import { VoltAgentModule } from '../../services/agents/voltagent.module';

@Module({
  imports: [PrismaModule, VoltAgentModule],
  controllers: [DonorsController],
  providers: [DonorsService],
  exports: [DonorsService], // ← BloodBankModule, HospitalModule, DoctorModule all consume this
})
export class DonorModule {}
