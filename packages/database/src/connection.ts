import pg from 'pg';
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export function databaseConnectionOptions(url: string, caPath = process.env.DATABASE_SSL_CA_PATH): pg.PoolConfig {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('資料庫連線設定格式不正確。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.hostname.endsWith('.pooler.supabase.com') && parsed.port === '6543') {
    throw new Error('PulseTools 必須使用 Session pooler，不能使用 Transaction pooler。');
  }
  // 避免 URL 的 sslmode 覆蓋驗證設定；遠端連線一律驗證憑證及主機名稱。
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(key);
  let ca: string | undefined;
  if (caPath) {
    try { ca = readFileSync(caPath, 'utf8'); } catch { throw new Error('無法讀取 DATABASE_SSL_CA_PATH 指定的憑證。'); }
  }
  return {
    connectionString: parsed.toString(), max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    options: '-c timezone=UTC -c statement_timeout=10000',
    ssl: local && !ca ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}
export function connectDatabase(url: string) {
  const pool = new pg.Pool({
    ...databaseConnectionOptions(url),
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
export type Database = ReturnType<typeof connectDatabase>['db'];
