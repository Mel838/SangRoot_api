import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DonorsController } from './donors.controller';
import { DonorsService } from './donors.service';

@Module({
  imports: [PrismaModule],
  controllers: [DonorsController],
  providers: [DonorsService],
  exports: [DonorsService], // ← BloodBankModule, HospitalModule, DoctorModule all consume this
})
export class DonorModule {}
