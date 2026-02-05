// import { registerAs } from '@nestjs/config';
// import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// export default registerAs(
//   'database',
//   (): TypeOrmModuleOptions => ({
//     type: 'postgres',
//     host: process.env.DB_HOST || 'localhost',
//     port: parseInt(process.env.DB_PORT, 10) || 5432,
//     username: process.env.DB_USERNAME || 'postgres',
//     password: process.env.DB_PASSWORD || 'postgres',
//     database: process.env.DB_DATABASE || 'blood_availability',
//     entities: [__dirname + '/../**/*.entity{.ts,.js}'],
//     synchronize: process.env.NODE_ENV !== 'production',
//     logging: process.env.NODE_ENV === 'development',
//     migrations: [__dirname + '/../migrations/*{.ts,.js}'],
//     migrationsRun: process.env.NODE_ENV === 'production',
//     cli: {
//       migrationsDir: 'src/migrations',
//     },
//   }),
// );

import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
