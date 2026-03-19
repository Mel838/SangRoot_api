import { Module } from '@nestjs/common';
import { BloodBanksController } from './blood-banks.controller';
import { BloodBanksService } from './blood-banks.service';
import { DonorModule } from '../donors/donors.module';

@Module({
  imports: [DonorModule],
  controllers: [BloodBanksController],
  providers: [BloodBanksService],
  exports: [BloodBanksService],
})
export class BloodBanksModule {}
