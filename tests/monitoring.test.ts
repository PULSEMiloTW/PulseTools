import { beforeEach, expect, it, vi } from 'vitest';
import { ErrorService } from '../packages/core/src/error-service.js';
import { HealthMonitor } from '../packages/core/src/health-monitor.js';
import { createCore, type Core } from '../packages/core/src/index.js';
import { MemoryRepository } from './helpers/memory-repository.js';
import type { PostgresMonitoringRepository } from '../packages/database/src/monitoring-repository.js';
import type { PostgresNotificationRepository } from '../packages/database/src/notification-repository.js';
import type { Client } from 'discord.js';
import { errorInputSchema, healthMetricsSchema } from '../packages/shared/src/monitoring.js';
const owner = '100000000000000001', admin = '100000000000000002', guildId = '200000000000000001';
const actor = { userId: owner, guildId, nativeAdministrator: false };
let core: Core, repository: MemoryRepository;
beforeEach(async () => {
  repository = new MemoryRepository(); core = createCore(repository, owner);
  await core.guilds.setAuthorization(owner, guildId, '測試', true);
  await core.modules.setEnabled(actor, 'PT-08', true);
});
it('錯誤明細與確認須授權，跨 Guild 與全域錯誤不可越權', async () => {
  const store = { list: vi.fn().mockResolvedValue([]), stats: vi.fn().mockResolvedValue([]), detail: vi.fn().mockResolvedValue(undefined), acknowledge: vi.fn() };
  const service = new ErrorService(core, store);
  await expect(service.list({ ...actor, userId: admin })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  await core.guilds.setOperator(owner, guildId, admin, 'admin');
  await expect(service.list({ ...actor, userId: admin, nativeAdministrator: true }, true)).rejects.toMatchObject({ code: 'OWNER_REQUIRED' });
  await expect(service.detail(actor, '00000000-0000-4000-a000-000000000001')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await service.list(actor, true); expect(store.list).toHaveBeenCalledWith(null);
  expect(store.acknowledge).not.toHaveBeenCalled();
});
it('錯誤確認在 Lockdown 下保留，但不能跳過 Guild 授權', async () => {
  const store = { list: vi.fn(), stats: vi.fn(), detail: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-a000-000000000001' }), acknowledge: vi.fn().mockResolvedValue(undefined) };
  const service = new ErrorService(core, store);
  await repository.setLockdown(true, owner);
  await service.acknowledge(actor, '00000000-0000-4000-a000-000000000001');
  expect(store.acknowledge).toHaveBeenCalledWith(guildId, expect.any(String), owner);
  await core.guilds.setAuthorization(owner, guildId, '測試', false);
  await expect(service.acknowledge(actor, '00000000-0000-4000-a000-000000000001')).rejects.toMatchObject({ code: 'GUILD_DENIED' });
});
it('錯誤輸入拒絕原始例外、未知代碼與機密欄位', () => {
  const input = { guildId, moduleId: 'PT-04', type: 'API', code: 'INTERNAL_ERROR', occurredAt: new Date() };
  expect(errorInputSchema.safeParse(input).success).toBe(true);
  for (const extra of [{ stack: 'secret-stack' }, { summary: 'secret-url' }, { code: 'secret-token' }]) expect(errorInputSchema.safeParse({ ...input, ...extra }).success).toBe(false);
});
function fixtures() {
  const store: Pick<PostgresMonitoringRepository,'sample'|'history'|'stats'|'prune'> = { sample: vi.fn().mockResolvedValue(undefined), history: vi.fn().mockResolvedValue([]), stats: vi.fn().mockResolvedValue([{ status: 'Open', groups: 2, count: 7 }]), prune: vi.fn().mockResolvedValue(undefined) };
  const notifications: Pick<PostgresNotificationRepository,'status'> = { status: vi.fn().mockResolvedValue([{ status: 'Sent', count: 5 }, { status: 'Pending', count: 3 }, { status: 'Failed', count: 1 }]) };
  const client = { isReady: () => true, rest: { get: vi.fn().mockResolvedValue({}) }, ws: { ping: 42 }, guilds: { cache: { size: 2 } } } as unknown as Client;
  return { store, notifications, client };
}
it('健康資訊使用本次程序時間、實際 Guild、REST API 與租戶佇列', async () => {
  const f = fixtures(), startedAt = new Date(Date.now() - 60000);
  const monitor = new HealthMonitor(core, f.client, startedAt, f.store, f.notifications);
  const metrics = await monitor.status(actor);
  expect(healthMetricsSchema.safeParse(metrics).success).toBe(true);
  expect(metrics.startedAt).toBe(startedAt.toISOString()); expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(60);
  expect(metrics.guildCount).toBe(2); expect(metrics.authorizedGuildCount).toBe(1); expect(metrics.gatewayPingMs).toBe(42);
  expect(metrics.apiLatencyMs).not.toBeNull(); expect(metrics.botStatus).toBe('Online');
  expect(metrics.errorCount).toBe(7); expect(metrics.pendingNotifications).toBe(3); expect(metrics.failedNotifications).toBe(1);
});
it('DB 與 API 失敗顯示 Degraded、Unavailable，不假造零延遲與零錯誤', async () => {
  const f = fixtures(); vi.mocked(f.client.rest.get).mockRejectedValue(new Error('secret'));
  vi.spyOn(repository, 'health').mockRejectedValue(new Error('secret'));
  vi.mocked(f.store.stats).mockRejectedValue(new Error('secret'));
  const metrics = await new HealthMonitor(core, f.client, new Date(), f.store, f.notifications).status(actor);
  expect(metrics.botStatus).toBe('Degraded'); expect(metrics.databaseHealthy).toBe(false); expect(metrics.databaseLatencyMs).toBeNull();
  expect(metrics.apiLatencyMs).toBeNull(); expect(metrics.errorCount).toBeNull();
});
it('健康採樣需 PT-05，並行 poll 不重入、停用後不新增樣本', async () => {
  const f = fixtures(), monitor = new HealthMonitor(core, f.client, new Date(), f.store, f.notifications);
  await monitor.poll(owner); expect(f.store.sample).not.toHaveBeenCalled();
  await core.modules.setEnabled(actor, 'PT-05', true);
  await Promise.all([monitor.poll(owner), monitor.poll(owner)]); expect(f.store.sample).toHaveBeenCalledTimes(1);
  await core.modules.setEnabled(actor, 'PT-05', false);
  await monitor.poll(owner); expect(f.store.sample).toHaveBeenCalledTimes(1); await monitor.shutdown();
});
