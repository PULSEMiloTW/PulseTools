import 'dotenv/config';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, sql } from 'drizzle-orm';
import { connectDatabase } from '../packages/database/src/connection.js';
import { PostgresRepository } from '../packages/database/src/repository.js';
import { configurationHistory, guilds, securityEvents } from '../packages/database/src/schema.js';
import { createCore } from '../packages/core/src/index.js';
import { auditEventTypes, guildConfigurationSchema } from '../packages/shared/src/models.js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { databaseConnectionOptions } from '../packages/database/src/connection.js';
import * as schema from '../packages/database/src/schema.js';
import { PostgresAuditRepository } from '../packages/database/src/audit-repository.js';
import { AuditService } from '../packages/core/src/audit-service.js';
import type { MessageEvent } from '../packages/shared/src/audit.js';
import { PostgresServerEventRepository } from '../packages/database/src/server-event-repository.js';
import { PostgresNotificationRepository } from '../packages/database/src/notification-repository.js';
import type { ServerEvent } from '../packages/shared/src/server-events.js';
import { PostgresModerationRepository } from '../packages/database/src/moderation-repository.js';
import { PostgresMonitoringRepository } from '../packages/database/src/monitoring-repository.js';

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
it('管理與監測四張表具 RLS，無匿名政策', async () => {
  const tables = ['moderation_cases','moderation_notes','error_records','health_samples'];
  const rows = await db.execute<{ relname: string; relrowsecurity: boolean }>(sql`select relname,relrowsecurity from pg_class where relnamespace=current_schema()::regnamespace and relname in ('moderation_cases','moderation_notes','error_records','health_samples')`);
  expect(rows.rows).toHaveLength(tables.length); expect(rows.rows.every((r) => r.relrowsecurity)).toBe(true);
  expect((await db.execute(sql`select * from pg_policies where schemaname=current_schema() and tablename in ('moderation_cases','moderation_notes','error_records','health_samples')`)).rows).toHaveLength(0);
});
it('案件持久化、並行相同指令僅建立一次、關聯與備註隔離', async () => {
  await core.modules.setEnabled(actor(guildA), 'PT-04', true);
  await core.modules.setEnabled(actor(guildB), 'PT-04', true);
  const cases = new PostgresModerationRepository(db);
  const request = { requestId: '400000000000000090', targetId: '100000000000000003', action: 'timeout' as const, durationMinutes: 1, reason: 'integration', confirmed: true };
  const results = await Promise.all([cases.begin(actor(guildA), request), cases.begin(actor(guildA), request)]);
  expect(results.filter((r) => r.created)).toHaveLength(1); expect(results[0]!.record.id).toBe(results[1]!.record.id);
  const original = await cases.finish(results[0]!.record, 'Succeeded', null, null);
  await cases.note(guildA, original.id, owner, 'case note');
  expect((await cases.notes(guildA, original.id))).toHaveLength(1);
  expect(await cases.detail(guildB, original.id)).toBeUndefined();
  await expect(cases.note(guildB, original.id, owner, 'wrong guild')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(cases.begin(actor(guildB), { ...request, requestId: '400000000000000091', action: 'untimeout', relatedCaseId: original.id })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  const release = await cases.begin(actor(guildA), { ...request, requestId: '400000000000000092', action: 'untimeout', relatedCaseId: original.id });
  expect(release.record.relatedCaseId).toBe(original.id); await cases.finish(release.record, 'Failed', 'DISCORD_50013', null);
  expect((await cases.detail(guildA, original.id))?.status).toBe('Succeeded');
  const reopened = testConnection();
  try { expect((await new PostgresModerationRepository(reopened.db).detail(guildA, original.id))?.reason).toBe('integration'); } finally { await reopened.pool.end(); }
}, 15000);
it('Pending 案件重啟恢復 Unknown、不重新執行，Lockdown 阻止新案件', async () => {
  const cases = new PostgresModerationRepository(db);
  const request = { requestId: '400000000000000093', targetId: '100000000000000003', action: 'warn' as const, reason: 'integration', confirmed: true };
  const pending = await cases.begin(actor(guildA), request); await cases.recover();
  expect((await cases.detail(guildA, pending.record.id))?.status).toBe('Unknown');
  expect((await cases.begin(actor(guildA), request)).created).toBe(false);
  await repository.setLockdown(true, owner);
  try { await expect(cases.begin(actor(guildA), { ...request, requestId: '400000000000000094' })).rejects.toMatchObject({ code: 'LOCKDOWN' }); }
  finally { await repository.setLockdown(false, owner); }
}, 10000);
it('錯誤並行聚合、單次通知、確認保留次數與跨 Guild 隔離', async () => {
  const monitoring = new PostgresMonitoringRepository(db);
  await core.modules.setEnabled(actor(guildA), 'PT-08', true);
  await core.configuration.setChannel(actor(guildA), 'error', '300000000000000008');
  const input = { guildId: guildA, moduleId: 'PT-04' as const, type: 'API' as const, code: 'INTERNAL_ERROR' as const, occurredAt: new Date() };
  const rows = await Promise.all(Array.from({ length: 4 }, () => monitoring.record(input)));
  expect(new Set(rows.map((r) => r!.id)).size).toBe(1);
  const id = rows[0]!.id;
  expect((await monitoring.detail(guildA, id))?.count).toBe(4); expect(await monitoring.detail(guildB, id)).toBeUndefined();
  expect((await db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.eventKey, `error:${id}`)))).toHaveLength(1);
  await monitoring.acknowledge(guildA, id, owner);
  const record = await monitoring.detail(guildA, id);
  expect(record?.status).toBe('Acknowledged'); expect(record?.acknowledgedBy).toBe(owner); expect(record?.count).toBe(4);
  await monitoring.record(input);
  expect((await monitoring.detail(guildA, id))?.status).toBe('Open');
  expect(JSON.stringify(record)).not.toContain('stack');
  const global = await monitoring.record({ ...input, guildId: '299999999999999999' });
  expect(global?.guildId).toBeNull(); expect(await monitoring.detail(guildA, global!.id)).toBeUndefined();
}, 15000);
it('管理通知同交易保存、包含已知操作者，個別開關停止新通知並取消舊路由', async () => {
  const cases = new PostgresModerationRepository(db), notifications = new PostgresNotificationRepository(db);
  await core.configuration.setChannel(actor(guildA), 'moderation', '300000000000000009');
  const request = { requestId: '400000000000000095', targetId: '100000000000000003', action: 'warn' as const, reason: 'private-case-reason', confirmed: true };
  const first = await cases.begin(actor(guildA), request); await cases.finish(first.record, 'Succeeded', null, null);
  const [job] = await db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.eventKey, `case:${first.record.id}`));
  expect(job?.moduleId).toBe('PT-04'); expect(job?.payload.metadata.moderatorId).toBe(owner); expect(JSON.stringify(job)).not.toContain('private-case-reason');
  expect(await notifications.configuration(job!)).toBeDefined();
  const policy = await core.configuration.view(actor(guildA));
  await core.configuration.replace(actor(guildA), { ...policy.configuration, moderation: { notifyActions: policy.configuration.moderation.notifyActions.filter((a) => a !== 'warn') } }, policy.revision);
  expect(await notifications.configuration(job!)).toBeUndefined();
  const second = await cases.begin(actor(guildA), { ...request, requestId: '400000000000000096' }); await cases.finish(second.record, 'Succeeded', null, null);
  expect((await db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.eventKey, `case:${second.record.id}`)))).toHaveLength(0);
}, 15000);
it('健康樣本持久化、模組停用不採樣、期限清理不影響案件', async () => {
  const monitoring = new PostgresMonitoringRepository(db), cases = new PostgresModerationRepository(db);
  await core.modules.setEnabled(actor(guildA), 'PT-05', true);
  const metrics = { startedAt: new Date().toISOString(), uptimeSeconds: 120, botStatus: 'Online' as const, gatewayPingMs: 50, apiLatencyMs: 10, databaseHealthy: true, databaseLatencyMs: 3, cpuPercent: 1, rssBytes: 1000, heapBytes: 500, guildCount: 2, authorizedGuildCount: 2, activeModuleCount: 3, errorCount: 4, pendingNotifications: 0, failedNotifications: 0 };
  await monitoring.sample(guildA, metrics); expect(await monitoring.history(guildA)).toHaveLength(1); expect(await monitoring.history(guildB)).toHaveLength(0);
  await core.modules.setEnabled(actor(guildA), 'PT-05', false);
  await monitoring.sample(guildA, metrics); expect(await monitoring.history(guildA)).toHaveLength(1);
  const count = await cases.count(guildA);
  await db.update(schema.healthSamples).set({ expiresAt: new Date(0) }).where(eq(schema.healthSamples.guildId, guildA)); await monitoring.prune();
  expect(await monitoring.history(guildA)).toHaveLength(0); expect(await cases.count(guildA)).toBe(count);
}, 10000);
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
const serverRepository = new PostgresServerEventRepository(db);
const notificationRepository = new PostgresNotificationRepository(db);
const serverEvent = (overrides: Partial<ServerEvent> = {}): ServerEvent => ({ guildId: guildA, entityId: owner, channelId: null, type: 'member.join', eventKey: 'session:1:member.join', receivedAt: new Date(), eventAt: null, metadata: { guildName: '整合測試 Guild', userId: owner, userName: '整合測試成員', memberCount: 65 }, ...overrides });
it('Phase 3 Migration、RLS 與各分類／歡迎頻道設定持久化', async () => {
  await core.modules.setEnabled(actor(guildA), 'PT-01', true);
  await core.modules.setEnabled(actor(guildA), 'PT-02', true);
  const guild = await core.configuration.view(actor(guildA));
  await core.configuration.replace(actor(guildA), { ...guild.configuration,
    audit: { ...guild.configuration.audit, enabledEvents: [...auditEventTypes] },
    channels: { message: '300000000000000010', member: '300000000000000011', voice: '300000000000000012', system: '300000000000000013' },
    welcome: { ...guild.configuration.welcome, joinChannel: '300000000000000014', leaveChannel: '300000000000000015' } }, guild.revision);
  const second = testConnection();
  try {
    const saved = await createCore(new PostgresRepository(second.db), owner).configuration.view(actor(guildA));
    expect(saved.configuration.welcome).toMatchObject({ joinChannel: '300000000000000014', leaveChannel: '300000000000000015' });
    expect((await core.configuration.view(actor(guildB))).configuration.welcome.joinChannel).toBeUndefined();
    const result = await second.db.execute<{ relrowsecurity: boolean }>(sql`select relrowsecurity from pg_class where relnamespace=current_schema()::regnamespace and relname in ('server_events','notification_outbox')`);
    expect(result.rows).toHaveLength(2); expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  } finally { await second.pool.end(); }
});
it('Server 事件與通知在同一交易去重，歡迎及 Audit 分別路由；Guild 隔離', async () => {
  expect((await Promise.all([serverRepository.ingest(serverEvent()), serverRepository.ingest(serverEvent())])).sort()).toEqual(['duplicate', 'stored']);
  const events = await serverRepository.recent(guildA);
  expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ attribution: '無法確認', timestampSource: 'received' });
  const jobs = await db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.eventKey, 'session:1:member.join'));
  expect(jobs.map((row) => row.channelId).sort()).toEqual(['300000000000000011', '300000000000000014']);
  expect(await serverRepository.ingest(serverEvent({ guildId: guildB }))).toBe('ignored');
  expect(await serverRepository.recent(guildB)).toHaveLength(0);
});
it('訊息通知只含中繼資料，紀錄輸出頻道排除回授', async () => {
  await auditRepository.ingest(messageEvent({ messageId: '400000000000000008', eventKey: 'phase3-message', content: 'private-phase3-original' }));
  const [saved] = await db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.eventKey, 'phase3-message'));
  expect(saved?.channelId).toBe('300000000000000010');
  expect(JSON.stringify(saved?.payload)).not.toContain('private-phase3-original');
  expect(await auditRepository.ingest(messageEvent({ channelId: '300000000000000010', eventKey: 'feedback' }))).toBe('ignored');
});
it('Audit 與歡迎路由相同時只發一筆歡迎通知，PT-02 可獨立於 PT-01 運作', async () => {
  await core.configuration.setChannel(actor(guildA), 'member', '300000000000000014');
  await serverRepository.ingest(serverEvent({ eventKey: 'shared-route' }));
  const jobs = await db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.eventKey, 'shared-route'));
  expect(jobs).toHaveLength(1); expect(jobs[0]?.moduleId).toBe('PT-02');
  await core.modules.setEnabled(actor(guildA), 'PT-01', false);
  expect(await serverRepository.ingest(serverEvent({ type: 'member.leave', eventKey: 'welcome-only' }))).toBe('stored');
  expect(await serverRepository.ingest(serverEvent({ type: 'voice.join', eventKey: 'disabled-audit' }))).toBe('ignored');
  await core.modules.setEnabled(actor(guildA), 'PT-01', true);
});
it('SKIP LOCKED 並行取任務不重複，重開連線保留 Sent 與結果不明狀態', async () => {
  const [first, second] = await Promise.all([notificationRepository.claim(), notificationRepository.claim()]);
  expect(first?.id).toBeDefined(); expect(second?.id).toBeDefined(); expect(first?.id).not.toBe(second?.id);
  await notificationRepository.sent(first!, '500000000000000001');
  const restarted = testConnection();
  try {
    const repository = new PostgresNotificationRepository(restarted.db);
    await repository.recover();
    const [sent] = await restarted.db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.id, first!.id));
    const [unknown] = await restarted.db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.id, second!.id));
    expect(sent).toMatchObject({ status: 'Sent', sentMessageId: '500000000000000001' });
    expect(unknown).toMatchObject({ status: 'Failed', errorCode: 'DELIVERY_UNKNOWN' });
  } finally { await restarted.pool.end(); }
});
it('通知依現在授權／路由驗證；最多三次可重試失敗後停止', async () => {
  const job = await notificationRepository.claim();
  expect(job).toBeDefined();
  await db.update(schema.notificationOutbox).set({ status: 'Cancelled' }).where(eq(schema.notificationOutbox.status, 'Pending'));
  await notificationRepository.fail(job!, 'DISCORD_RETRYABLE', true);
  const second = await notificationRepository.claim(new Date(Date.now() + 60000));
  expect(second?.id).toBe(job!.id); expect(second?.attempts).toBe(2);
  await notificationRepository.fail(second!, 'DISCORD_RETRYABLE', true);
  const third = await notificationRepository.claim(new Date(Date.now() + 60000));
  expect(third?.attempts).toBe(3);
  await notificationRepository.fail(third!, 'DISCORD_RETRYABLE', true);
  const [failed] = await db.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.id, job!.id));
  expect(failed?.status).toBe('Failed');
  await core.modules.setEnabled(actor(guildA), job!.moduleId, false);
  expect(await notificationRepository.configuration(job!)).toBeUndefined();
  await core.modules.setEnabled(actor(guildA), job!.moduleId, true);
});
it('獨立事件開關停止 Server 記錄；測試通知明確標示且無假 Audit 事件', async () => {
  const guild = await core.configuration.view(actor(guildA));
  await core.configuration.setAudit(actor(guildA), { ...guild.configuration.audit, enabledEvents: guild.configuration.audit.enabledEvents.filter((type) => type !== 'voice.join') });
  expect(await serverRepository.ingest(serverEvent({ type: 'voice.join', eventKey: 'off-voice' }))).toBe('ignored');
  const before = (await serverRepository.recent(guildA)).length;
  await notificationRepository.test(guildA, 'PT-02', 'member.join', { userId: owner, userName: '明確測試通知' });
  expect((await serverRepository.recent(guildA)).length).toBe(before);
  const [queued] = await db.select().from(schema.notificationOutbox).where(and(eq(schema.notificationOutbox.status, 'Pending'), eq(schema.notificationOutbox.moduleId, 'PT-02')));
  expect(queued?.payload.isTest).toBe(true);
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
  expect(await db.select().from(schema.notificationOutbox)).toHaveLength(0);
  expect(await db.select().from(schema.serverEvents)).toHaveLength(0);
  expect((await repository.guild(guildA))?.authorized).toBe(true);
}, 15000);
it('撤銷 Guild 不刪除持久設定但立即拒絕讀取與新事件', async () => {
  await core.guilds.setAuthorization(owner, guildA, '測試 A', false);
  await expect(core.configuration.view(actor(guildA))).rejects.toMatchObject({ code: 'GUILD_DENIED' });
  expect((await db.select().from(guilds).where(eq(guilds.id, guildA)))[0]?.configuration.timezone).toBe('UTC');
  expect(await auditRepository.ingest(messageEvent({ eventKey: 'revoked' }))).toBe('ignored');
});
