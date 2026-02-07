import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpLoggerMiddleware } from './common/utils/http-logger.middleware';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import { BloodBanksModule } from './modules/blood-banks/blood-banks.module';
import { DoctorsModule } from './modules/doctors/doctors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    HospitalsModule,
    BloodBanksModule,
    DoctorsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HttpLoggerMiddleware)
      .forRoutes('*');
  }
}
