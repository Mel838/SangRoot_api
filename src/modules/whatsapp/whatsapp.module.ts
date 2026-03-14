import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsAppCloudService } from '../../services/whatsapp-cloud.service';
import { VoltAgentModule } from '../../services/agents/voltagent.module';

@Module({
  imports: [VoltAgentModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsAppCloudService],
  exports: [WhatsappService, WhatsAppCloudService],
})
export class WhatsappModule {}
