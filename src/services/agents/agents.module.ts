import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
