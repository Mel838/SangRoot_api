const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sangroot_agent_memory_messages';
    `);
    console.log(res.rows);
  } finally {
    await pool.end();
  }
}
run();
