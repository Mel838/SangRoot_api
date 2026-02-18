import {
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor() {
		const adapter = new PrismaPg({
			connectionString: process.env.DATABASE_URL!,
			pool: {
				ssl: { rejectUnauthorized: false },
			},
		});

		super({ adapter });
	}

	async onModuleInit() {
		await this.$connect();
		console.log("✅ Database connected successfully");
	}

	async onModuleDestroy() {
		await this.$disconnect();
		console.log("👋 Database disconnected");
	}

	async cleanDatabase() {
		if (process.env.NODE_ENV === "production") {
			throw new Error("Cannot clean database in production!");
		}

		await this.$transaction([
			this.bloodRequest.deleteMany(),
			this.donor.deleteMany(),
			this.hospitalInvite.deleteMany(),
			this.doctor.deleteMany(),
			this.hospital.deleteMany(),
			this.bloodBank.deleteMany(),
			this.user.deleteMany(),
		]);
	}
}
