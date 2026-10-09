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
import { PostgresAuditRepository } from '../packages/database/src/audit-repository.js';
import { AuditService } from '../packages/core/src/audit-service.js';
import type { MessageEvent } from '../packages/shared/src/audit.js';

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
it('原文及 Audit 表啟用 RLS 且沒有匿名 API 讀取政策', async () => {
  const result = await db.execute<{ relname: string; relrowsecurity: boolean }>(sql`select relname, relrowsecurity from pg_class where relnamespace = current_schema()::regnamespace and relname in ('audit_events', 'message_snapshots', 'message_versions')`);
  expect(result.rows).toHaveLength(3);
  expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  const policies = await db.execute(sql`select * from pg_policies where schemaname = current_schema() and tablename in ('audit_events', 'message_snapshots', 'message_versions')`);
  expect(policies.rows).toHaveLength(0);
});
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
const auditRepository = new PostgresAuditRepository(db);
const audit = new AuditService(auditRepository, core);
const channel = '300000000000000001';
const message = '400000000000000001';
const messageEvent = (overrides: Partial<MessageEvent> = {}): MessageEvent => ({ guildId: guildA, channelId: channel, messageId: message, authorId: owner,
  type: 'message.create', eventKey: 'create:1', content: '原文', partial: false, receivedAt: new Date(), eventAt: new Date(), ...overrides });
it('原文預設關閉，事件不含內容且沒有 Snapshot', async () => {
  await core.modules.setEnabled(actor(guildA), 'PT-01', true);
  expect(await auditRepository.ingest(messageEvent())).toBe('stored');
  expect(await auditRepository.snapshot(guildA, message)).toBeUndefined();
  expect(JSON.stringify(await auditRepository.recent(guildA))).not.toContain('原文');
});
it('明確確認才可保存，建立、編輯、刪除版本及重開連線持久化', async () => {
  const guild = await core.configuration.view(actor(guildA));
  const capture = { ...guild.configuration.capture, enabled: true, allowedChannels: [channel], privacyNotice: '整合測試原文告知' };
  await expect(core.configuration.setCapture(actor(guildA), capture, false)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await core.configuration.setCapture(actor(guildA), capture, true);
  const created = new Date();
  expect(await auditRepository.ingest(messageEvent({ eventKey: 'create:2', eventAt: created }))).toBe('stored');
  await auditRepository.ingest(messageEvent({ type: 'message.update', eventKey: 'update:2', content: '編輯版本', eventAt: new Date(created.getTime() + 1) }));
  await auditRepository.ingest(messageEvent({ type: 'message.delete', eventKey: 'delete:2', content: null, partial: true, eventAt: null }));
  const second = testConnection();
  try {
    const saved = await new PostgresAuditRepository(second.db).snapshot(guildA, message);
    expect(saved?.snapshot.originalContent).toBe('原文');
    expect(saved?.snapshot.latestContent).toBe('編輯版本');
    expect(saved?.snapshot.deletedAt).toBeInstanceOf(Date);
    expect(saved?.snapshot.captureStatus).toBe('Captured');
    expect(saved?.versions.map((version) => version.content)).toEqual(['編輯版本', '編輯版本', '原文']);
    expect((await auditRepository.recent(guildA)).find((value) => value.eventKey === 'delete:2')).toMatchObject({ timestampSource: 'received', actorId: null, attribution: '無法確認' });
  } finally { await second.pool.end(); }
});
it('並行重複事件只建立一筆 Audit 與版本；Guild 不能讀取另一 Guild 原文', async () => {
  const input = messageEvent({ messageId: '400000000000000002', eventKey: 'concurrent:1' });
  const results = await Promise.all([auditRepository.ingest(input), auditRepository.ingest(input)]);
  expect(results.sort()).toEqual(['duplicate', 'stored']);
  expect((await auditRepository.snapshot(guildA, input.messageId))?.versions).toHaveLength(1);
  const at = new Date();
  await Promise.all([
    auditRepository.ingest({ ...input, type: 'message.update', eventKey: 'concurrent:update:1', content: '較早版本', eventAt: at }),
    auditRepository.ingest({ ...input, type: 'message.update', eventKey: 'concurrent:update:2', content: '較晚版本', eventAt: new Date(at.getTime() + 1) }),
  ]);
  const saved = await auditRepository.snapshot(guildA, input.messageId);
  expect(saved?.versions).toHaveLength(3);
  expect(saved?.snapshot.latestContent).toBe('較晚版本');
  expect(await auditRepository.snapshot(guildB, input.messageId)).toBeUndefined();
  expect(await auditRepository.recent(guildB)).toHaveLength(0);
});
it('未保存的刪除、Partial、更新後才開始捕捉與亂序事件不偽造原文', async () => {
  const id = '400000000000000003';
  await auditRepository.ingest(messageEvent({ messageId: id, type: 'message.delete', eventKey: 'unknown-delete', content: null, partial: true, eventAt: null }));
  expect((await auditRepository.snapshot(guildA, id))?.snapshot).toMatchObject({ originalContent: null, latestContent: null, captureStatus: 'Unavailable' });
  const edited = '400000000000000004';
  const at = new Date();
  await auditRepository.ingest(messageEvent({ messageId: edited, type: 'message.update', eventKey: 'late-edit', content: '新版本', eventAt: at }));
  await auditRepository.ingest(messageEvent({ messageId: edited, type: 'message.update', eventKey: 'early-edit', content: '較舊版本', eventAt: new Date(at.getTime() - 10) }));
  expect((await auditRepository.snapshot(guildA, edited))?.snapshot).toMatchObject({ originalContent: null, latestContent: '新版本' });
  await auditRepository.ingest(messageEvent({ messageId: edited, type: 'message.update', eventKey: 'partial-edit', content: null, partial: true, eventAt: new Date(at.getTime() + 10) }));
  expect((await auditRepository.snapshot(guildA, edited))?.snapshot).toMatchObject({ originalContent: null, latestContent: '新版本', captureStatus: 'Unavailable' });
});
it('排除頻道、事件開關與停用模組停止新資料寫入', async () => {
  const guild = await core.configuration.view(actor(guildA));
  await core.configuration.setCapture(actor(guildA), { ...guild.configuration.capture, excludedChannels: [channel] }, false);
  const id = '400000000000000005';
  await auditRepository.ingest(messageEvent({ messageId: id, eventKey: 'excluded:1' }));
  expect(await auditRepository.snapshot(guildA, id)).toBeUndefined();
  await expect(audit.snapshot(actor(guildA), message)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  await core.configuration.setAudit(actor(guildA), { enabledEvents: [], retentionDays: 30 });
  expect(await auditRepository.ingest(messageEvent({ eventKey: 'disabled-event' }))).toBe('ignored');
  await core.modules.setEnabled(actor(guildA), 'PT-01', false);
  expect(await auditRepository.ingest(messageEvent({ eventKey: 'disabled-module' }))).toBe('ignored');
});
it('原文查閱須明確 viewer 授權、原生管理員與同 Guild 內部角色', async () => {
  const guild = await core.configuration.view(actor(guildA));
  const viewer = '100000000000000002';
  await core.configuration.setCapture(actor(guildA), { ...guild.configuration.capture, excludedChannels: [], viewerIds: [] }, true);
  await expect(audit.snapshot({ userId: viewer, guildId: guildA, nativeAdministrator: true }, message)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  const current = await core.configuration.view(actor(guildA));
  await core.configuration.setCapture(actor(guildA), { ...current.configuration.capture, viewerIds: [viewer] }, false);
  expect((await audit.snapshot({ userId: viewer, guildId: guildA, nativeAdministrator: true }, message))?.snapshot.messageId).toBe(message);
  await expect(audit.snapshot({ userId: viewer, guildId: guildA, nativeAdministrator: false }, message)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  await expect(audit.snapshot({ userId: viewer, guildId: guildB, nativeAdministrator: true }, message)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
});
it('保存期限縮短後清除 Snapshot、級聯版本及事件，但不移除 Guild 設定', async () => {
  await core.modules.setEnabled(actor(guildA), 'PT-01', true);
  await core.configuration.setAudit(actor(guildA), { enabledEvents: ['message.create', 'message.update', 'message.delete'], retentionDays: 30 });
  const old = '400000000000000006';
  const time = new Date(Date.now() - 2 * 86400000);
  await auditRepository.ingest(messageEvent({ messageId: old, eventKey: 'old:1', eventAt: time, receivedAt: time }));
  const guild = await core.configuration.view(actor(guildA));
  await core.configuration.replace(actor(guildA), { ...guild.configuration, capture: { ...guild.configuration.capture, retentionDays: 1 }, audit: { ...guild.configuration.audit, retentionDays: 1 } }, guild.revision);
  expect(await auditRepository.snapshot(guildA, old)).toBeUndefined();
  await auditRepository.prune();
  expect(await db.select().from(schema.messageSnapshots).where(eq(schema.messageSnapshots.messageId, old))).toHaveLength(0);
  expect(await db.select().from(schema.messageVersions).where(eq(schema.messageVersions.messageId, old))).toHaveLength(0);
  await auditRepository.prune(new Date(Date.now() + 31 * 86400000));
  expect(await auditRepository.snapshot(guildA, message)).toBeUndefined();
  expect(await db.select().from(schema.messageVersions)).toHaveLength(0);
  expect(await auditRepository.recent(guildA)).toHaveLength(0);
  expect((await repository.guild(guildA))?.authorized).toBe(true);
});
it('撤銷 Guild 不刪除持久設定但立即拒絕讀取與新事件', async () => {
  await core.guilds.setAuthorization(owner, guildA, '測試 A', false);
  await expect(core.configuration.view(actor(guildA))).rejects.toMatchObject({ code: 'GUILD_DENIED' });
  expect((await db.select().from(guilds).where(eq(guilds.id, guildA)))[0]?.configuration.timezone).toBe('UTC');
  expect(await auditRepository.ingest(messageEvent({ eventKey: 'revoked' }))).toBe('ignored');
});
