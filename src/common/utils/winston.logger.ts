import { WinstonModule } from "nest-winston";
import * as winston from "winston";

export const winstonLogger = WinstonModule.createLogger({
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.timestamp(),
				winston.format.simple(),
			),
		}),

		new winston.transports.File({
			filename: "logs/app.log",
			level: "info",
		}),
	],
});
