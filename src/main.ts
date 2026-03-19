import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { winstonLogger } from './common/utils/winston.logger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  // Enable CORS
  app.enableCors({
    origin: '*',
  });

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Cookie parser for refresh token cookie handling
  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
