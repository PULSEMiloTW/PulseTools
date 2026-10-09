import 'dotenv/config';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, sql } from 'drizzle-orm';
import { connectDatabase } from '../packages/database/src/connection.js';
import { PostgresRepository } from '../packages/database/src/repository.js';
import { configurationHistory, guilds, securityEvents } from '../packages/database/src/schema.js';
import { createCore } from '../packages/core/src/index.js';
import { guildConfigurationSchema } from '../packages/shared/src/models.js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { databaseConnectionOptions } from '../packages/database/src/connection.js';
import * as schema from '../packages/database/src/schema.js';

const sandbox = process.env.DATABASE_TEST_SCHEMA_ISOLATION === '1';
const url = sandbox ? process.env.DATABASE_URL : process.env.TEST_DATABASE_URL;
if (!url) throw new Error('PostgreSQL 整合驗收未執行：請設定專用空 TEST_DATABASE_URL。');
// 安全邊界：不可使用正式 Bot 的 DATABASE_URL；測試資料庫名稱必須包含 test。
let parsed: URL;
try { parsed = new URL(url); } catch { throw new Error('TEST_DATABASE_URL 格式不正確；不輸出連線值。'); }
if (!sandbox && (url === process.env.DATABASE_URL || !/test/i.test(parsed.pathname))) throw new Error('測試只能使用名稱包含 test 且與 Bot 不同的專用資料庫。');
const sandboxName = `pt_test_${randomUUID().replaceAll('-', '')}`;
if (!/^pt_test_[a-f0-9]{32}$/.test(sandboxName)) throw new Error('測試 Schema 名稱無效。');
function testConnection() {
  if (!sandbox) return connectDatabase(url!);
  // 不包含 public fallback；Schema 不存在或表缺失時只能失敗，不能寫到正式表。
  const testPool = new pg.Pool({ ...databaseConnectionOptions(url!), options: `-c timezone=UTC -c statement_timeout=10000 -c search_path=${sandboxName}` });
  return { pool: testPool, db: drizzle(testPool, { schema }) };
}
const { db, pool } = testConnection();
const administration = sandbox ? connectDatabase(url) : undefined;
const owner = '100000000000000001';
const guildA = '200000000000000001';
const guildB = '200000000000000002';
const repository = new PostgresRepository(db);
const core = createCore(repository, owner);
const actor = (guildId: string) => ({ userId: owner, guildId, nativeAdministrator: false });
let schemaCreated = false;
let sandboxCreated = false;
beforeAll(async () => {
  try {
    if (administration) {
      // CREATE 不使用 IF NOT EXISTS；只有本次成功建立的唯一 Schema 才可於測試後移除。
      await administration.db.execute(sql.raw(`CREATE SCHEMA "${sandboxName}"`));
      sandboxCreated = true;
      await administration.db.execute(sql.raw(`REVOKE ALL ON SCHEMA "${sandboxName}" FROM PUBLIC`));
      await db.transaction(async (tx) => {
        for (const migration of readMigrationFiles({ migrationsFolder: 'packages/database/migrations' })) {
          for (const statement of migration.sql) {
            // Drizzle 生成 FK 帶 public 前綴；測試 namespace 內必須關聯自己的表。
            await tx.execute(sql.raw(statement.replaceAll('"public".', `"${sandboxName}".`)));
          }
        }
      });
    } else {
    // 整合測試要求空資料庫，不能清空既有使用者資料。
    const result = await db.execute<{ count: string }>(sql`select count(*)::text as count from information_schema.tables where table_schema in ('public', 'drizzle')`);
    if (result.rows[0]?.count !== '0') throw new Error('not-empty');
    await migrate(db, { migrationsFolder: 'packages/database/migrations' });
    }
    schemaCreated = true;
    await core.guilds.setAuthorization(owner, guildA, '測試 A', true);
    await core.guilds.setAuthorization(owner, guildB, '測試 B', true);
  } catch { throw new Error('PostgreSQL 測試初始化失敗：確認專用空測試資料庫、連線及 migration；不會清除既有資料。'); }
}, 60000);
afterAll(async () => {
  await pool.end();
  if (administration) {
    try {
      if (sandboxCreated) await administration.db.execute(sql.raw(`DROP SCHEMA "${sandboxName}" CASCADE`));
    } finally { await administration.pool.end(); }
  }
});
it('Migration 建立真實 PostgreSQL Schema', () => { expect(schemaCreated).toBe(true); });
it('兩個 Guild 設定保存與重開連線後仍隔離', async () => {
  await core.configuration.setTimezone(actor(guildA), 'UTC');
  const second = testConnection();
  try {
    const restarted = createCore(new PostgresRepository(second.db), owner);
    expect((await restarted.configuration.view(actor(guildA))).configuration.timezone).toBe('UTC');
    expect((await restarted.configuration.view(actor(guildB))).configuration.timezone).toBe('Asia/Taipei');
  } finally { await second.pool.end(); }
});
it('資料庫交易拒絕過期版本且不多寫歷史', async () => {
  const current = await core.configuration.view(actor(guildB));
  const results = await Promise.allSettled([
    core.configuration.replace(actor(guildB), guildConfigurationSchema.parse({ timezone: 'UTC' }), current.revision),
    core.configuration.replace(actor(guildB), guildConfigurationSchema.parse({ timezone: 'Asia/Taipei' }), current.revision),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const history = await db.select().from(configurationHistory).where(eq(configurationHistory.guildId, guildB));
  expect(history).toHaveLength(1);
});
it('設定、操作員與模組持久化後能恢復', async () => {
  await core.guilds.setOperator(owner, guildA, '100000000000000002', 'admin');
  await core.modules.setEnabled(actor(guildA), 'PT-03', true);
  const restarted = createCore(new PostgresRepository(db), owner);
  await restarted.modules.restore();
  expect(await restarted.modules.enabled(guildA, 'PT-03')).toBe(true);
  expect(await restarted.modules.enabled(guildB, 'PT-03')).toBe(false);
  expect(await repository.operator(guildA, '100000000000000002')).toBe('admin');
  expect(await repository.operator(guildB, '100000000000000002')).toBeUndefined();
});
it('UTC 時間與事件來源保存於資料庫', async () => {
  const events = await db.select().from(securityEvents).where(and(eq(securityEvents.guildId, guildA), eq(securityEvents.action, 'configuration.change')));
  expect(events.length).toBeGreaterThan(0);
  expect(events[0]?.timestampSource).toBe('received');
  expect(events[0]?.eventAt).toBeInstanceOf(Date);
  const timezone = await db.execute(sql`show timezone`);
  expect(timezone.rows[0]?.TimeZone).toBe('UTC');
});
it('撤銷 Guild 不刪除持久設定但立即拒絕讀取', async () => {
  await core.guilds.setAuthorization(owner, guildA, '測試 A', false);
  await expect(core.configuration.view(actor(guildA))).rejects.toMatchObject({ code: 'GUILD_DENIED' });
  expect((await db.select().from(guilds).where(eq(guilds.id, guildA)))[0]?.configuration.timezone).toBe('UTC');
});
