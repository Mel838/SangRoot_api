import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpLoggerMiddleware } from './common/utils/http-logger.middleware';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { BloodBanksModule } from './modules/blood-banks/blood-banks.module';
import { VoltAgentModule } from './services/agents/voltagent.module';
import { InternalAgentsModule } from './modules/internal-agents/internal-agents.module';
import { BloodRequestsModule } from './modules/blood-requests/blood-requests.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { DonorModule } from './modules/donors/donors.module';
import { FeedbackModule } from './modules/feedback/feedback.module'; // 👈 ADD THIS IMPORT

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    PrismaModule,
    AuthModule,
    HospitalsModule,
    DoctorsModule,
    BloodBanksModule,
    InternalAgentsModule,
    BloodRequestsModule,
    VoltAgentModule,
    WhatsappModule,
    DonorModule,
    FeedbackModule, // 👈 ADD THIS LINE
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
