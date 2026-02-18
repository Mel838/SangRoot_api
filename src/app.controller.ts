import { Controller, Get, Logger } from "@nestjs/common";
import type { AppService } from "./app.service";

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}
	private readonly logger = new Logger(AppController.name);

	@Get()
	getHello(): string {
		this.logger.log("Fetching all users");
		return this.appService.getHello();
	}
}
