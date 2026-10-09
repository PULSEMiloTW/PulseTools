import { expect, it } from 'vitest';
import { databaseConnectionOptions } from '../packages/database/src/connection.js';

it('本機 PostgreSQL 可不使用 TLS', () => {
  expect(databaseConnectionOptions('postgresql://localhost/test', '').ssl).toBe(false);
});
it('遠端 PostgreSQL 必須驗證 TLS，URL 不能削弱驗證', () => {
  const options = databaseConnectionOptions('postgresql://user:offline@host.example:5432/postgres?sslmode=disable', '');
  expect(options.ssl).toEqual({ rejectUnauthorized: true });
  expect(options.connectionString).not.toContain('sslmode');
});
it('拒絕 Supabase Transaction pooler，避免程序鎖失效', () => {
  expect(() => databaseConnectionOptions('postgresql://user:offline@aws.example.pooler.supabase.com:6543/postgres', '')).toThrow('Session pooler');
});
it('不存在的 CA 路徑安全拒絕，不帶連線密碼', () => {
  expect(() => databaseConnectionOptions('postgresql://user:offline@host.example/postgres', 'missing-ca-file.crt')).toThrow('DATABASE_SSL_CA_PATH');
});
