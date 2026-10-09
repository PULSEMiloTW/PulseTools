import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { connectDatabase } from '../packages/database/src/connection.js';

async function run() {
  if (!process.env.DATABASE_URL) throw new Error('請在 .env 設定 DATABASE_URL。');
  const { db, pool } = connectDatabase(process.env.DATABASE_URL);
  try { await migrate(db, { migrationsFolder: 'packages/database/migrations' }); console.info('資料庫 Migration 完成。'); }
  finally { await pool.end(); }
}
run().catch(() => { console.error('Migration 失敗；請檢查專用資料庫、權限與 Migration 檔案。未輸出原始連線資訊。'); process.exitCode = 1; });
