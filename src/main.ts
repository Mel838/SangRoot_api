import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { winstonLogger } from "./common/utils/winston.logger"

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
     logger: winstonLogger,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
