import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  async onModuleInit() {
    console.log('Initializing database schema...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await this.pool.query(schema);

    console.log('Database schema ready');
  }
}