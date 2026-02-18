import {
	type MiddlewareConsumer,
	Module,
	type NestModule,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HttpLoggerMiddleware } from "./common/utils/http-logger.middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { BloodBanksModule } from "./modules/blood-banks/blood-banks.module";
import { DoctorsModule } from "./modules/doctors/doctors.module";
import { HospitalsModule } from "./modules/hospitals/hospitals.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AgentsModule } from "./services/agents/agents.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		PrismaModule,
		AuthModule,
		HospitalsModule,
		DoctorsModule,
		BloodBanksModule,
		AgentsModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(HttpLoggerMiddleware).forRoutes("*");
	}
}
