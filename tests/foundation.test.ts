import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCore, type Core } from '../packages/core/src/index.js';
import { moduleCatalog } from '../packages/modules/src/catalog.js';
import { ModuleManager } from '../packages/core/src/module-manager.js';
import { MemoryRepository } from './helpers/memory-repository.js';
import { guildConfigurationSchema, type Actor } from '../packages/shared/src/models.js';

const owner = '100000000000000001';
const admin = '100000000000000002';
const member = '100000000000000003';
const guildA = '200000000000000001';
const guildB = '200000000000000002';
const actor = (userId = owner, guildId = guildA, nativeAdministrator = true): Actor => ({ userId, guildId, nativeAdministrator });
let repository: MemoryRepository;
let core: Core;
beforeEach(async () => {
  repository = new MemoryRepository(); core = createCore(repository, owner);
  await core.guilds.setAuthorization(owner, guildA, '測試 A', true);
  await core.guilds.setAuthorization(owner, guildB, '測試 B', true);
});
describe('Owner 與 Guild 授權', () => {
  it('Guild Administrator 不能成為 Owner', async () => {
    await expect(core.guilds.setAuthorization(admin, guildA, '測試', false)).rejects.toMatchObject({ code: 'OWNER_REQUIRED' });
    expect((await repository.guild(guildA))?.authorized).toBe(true);
  });
  it('未授權 Guild 拒絕所有設定讀取，Owner 也受限制', async () => {
    await core.guilds.setAuthorization(owner, guildA, '測試', false);
    await expect(core.configuration.view(actor())).rejects.toMatchObject({ code: 'GUILD_DENIED' });
  });
  it('沒有內部授權的 Discord 管理員仍被拒絕', async () => {
    await expect(core.configuration.view(actor(admin))).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('內部管理員也必須有 Discord 原生管理權限', async () => {
    await core.guilds.setOperator(owner, guildA, admin, 'admin');
    await expect(core.configuration.view(actor(admin, guildA, false))).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(core.configuration.view(actor(admin))).resolves.toMatchObject({ id: guildA });
  });
  it('授權只作用於指定 Guild', async () => {
    await core.guilds.setOperator(owner, guildA, admin, 'admin');
    await expect(core.configuration.view(actor(admin, guildB))).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('Moderator 不能管理 Guild 設定', async () => {
    await core.guilds.setOperator(owner, guildA, member, 'moderator');
    await expect(core.configuration.view(actor(member))).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('撤銷操作員後拒絕新的讀取', async () => {
    await core.guilds.setOperator(owner, guildA, admin, 'admin');
    await core.guilds.setOperator(owner, guildA, admin, null);
    await expect(core.configuration.view(actor(admin))).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('拒絕不合法 Guild ID', async () => {
    await expect(core.guilds.setAuthorization(owner, '../other', '測試', true)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it('Lockdown 拒絕寫入但保留讀取與 Owner 安全復原', async () => {
    await repository.setLockdown(true, owner);
    await expect(core.configuration.setTimezone(actor(), 'UTC')).rejects.toMatchObject({ code: 'LOCKDOWN' });
    await expect(core.configuration.view(actor())).resolves.toBeDefined();
    await repository.setLockdown(false, owner);
    await expect(core.configuration.setTimezone(actor(), 'UTC')).resolves.toBeDefined();
  });
});
describe('設定與原文預設', () => {
  it('原文保存預設關閉，沒有預設監聽頻道', async () => {
    expect((await core.configuration.view(actor())).configuration).toMatchObject({ channels: {}, capture: { enabled: false, allowedChannels: [] } });
  });
  it('兩個 Guild 設定完全隔離，修改立即可讀取', async () => {
    await core.configuration.setTimezone(actor(), 'UTC');
    await core.configuration.setChannel(actor(), 'system', '300000000000000001');
    expect((await core.configuration.view(actor())).configuration).toMatchObject({ timezone: 'UTC', channels: { system: '300000000000000001' } });
    expect((await core.configuration.view(actor(owner, guildB))).configuration).toMatchObject({ timezone: 'Asia/Taipei', channels: {} });
  });
  it('過期版本不能覆蓋新的設定', async () => {
    const old = await core.configuration.view(actor());
    await core.configuration.setTimezone(actor(), 'UTC');
    await expect(core.configuration.replace(actor(), old.configuration, old.revision)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('競爭寫入僅有一筆成功', async () => {
    const config = guildConfigurationSchema.parse({});
    const results = await Promise.allSettled([core.configuration.replace(actor(), config, 0), core.configuration.replace(actor(), config, 0)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
  it('不合法時區、語言、Secret 及超大保存期間都被拒絕', async () => {
    await expect(core.configuration.setTimezone(actor(), 'Invalid/Timezone')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    for (const data of [{ language: 'en-US' }, { secret: 'never-save' }, { capture: { retentionDays: 0 } }]) {
      await expect(core.configuration.replace(actor(), data, 0)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    }
    expect((await repository.guild(guildA))?.revision).toBe(0);
  });
  it('重新建立服務仍可讀取 Repository 設定', async () => {
    await core.configuration.setTimezone(actor(), 'UTC');
    const restarted = createCore(repository, owner);
    expect((await restarted.configuration.view(actor())).configuration.timezone).toBe('UTC');
  });
  it('Guild 撤銷後保留歷史設定，重新授權不重設', async () => {
    await core.configuration.setTimezone(actor(), 'UTC');
    await core.guilds.setAuthorization(owner, guildA, '測試', false);
    await core.guilds.setAuthorization(owner, guildA, '測試', true);
    expect((await core.configuration.view(actor())).configuration.timezone).toBe('UTC');
    expect(repository.events.some((event) => event.action === 'configuration.change')).toBe(true);
  });
});
describe('模組生命週期', () => {
  it('十個模組預設未啟用，未實作模組標 Unavailable', async () => {
    const states = await core.modules.list(actor());
    expect(states).toHaveLength(10);
    expect(states.every((state) => !state.enabled)).toBe(true);
    expect(states.find((state) => state.id === 'PT-10')?.health).toBe('Unavailable');
    await expect(core.modules.setEnabled(actor(), 'PT-10', true)).rejects.toMatchObject({ code: 'MODULE_UNAVAILABLE' });
  });
  it('模組開關按 Guild 隔離', async () => {
    await core.modules.setEnabled(actor(), 'PT-03', true);
    expect(await core.modules.enabled(guildA, 'PT-03')).toBe(true);
    expect(await core.modules.enabled(guildB, 'PT-03')).toBe(false);
    await core.modules.setEnabled(actor(), 'PT-03', false);
    expect(await core.modules.enabled(guildA, 'PT-03')).toBe(false);
    await expect(core.configuration.view(actor())).resolves.toBeDefined();
  });
  it('撤銷 Guild 後立即停止業務模組授權', async () => {
    await core.modules.setEnabled(actor(), 'PT-03', true);
    await core.guilds.setAuthorization(owner, guildA, '測試', false);
    expect(await core.modules.enabled(guildA, 'PT-03')).toBe(false);
  });
  it('重啟恢復已儲存的啟用狀態', async () => {
    await core.modules.setEnabled(actor(), 'PT-03', true);
    const restarted = createCore(repository, owner);
    await restarted.modules.restore();
    expect(await restarted.modules.enabled(guildA, 'PT-03')).toBe(true);
  });
  it('重複與同時啟用只 initialize 一次', async () => {
    const definition = moduleCatalog.find((module) => module.id === 'PT-03')!;
    const initialize = vi.fn(async () => {});
    const manager = new ModuleManager(repository, core.permissions, [{ ...definition, initialize }]);
    await Promise.all([manager.setEnabled(actor(), 'PT-03', true), manager.setEnabled(actor(), 'PT-03', true)]);
    expect(initialize).toHaveBeenCalledTimes(1);
  });
  it('單一模組初始化失敗不影響其他模組', async () => {
    const definitions = moduleCatalog.map((definition) => definition.id === 'PT-03' ? { ...definition, initialize: async () => { throw new Error('模組錯誤'); } } : definition);
    const manager = new ModuleManager(repository, core.permissions, definitions);
    await expect(manager.setEnabled(actor(), 'PT-03', true)).rejects.toMatchObject({ code: 'MODULE_UNAVAILABLE' });
    await manager.setEnabled(actor(), 'PT-07', true);
    const states = await manager.list(actor());
    expect(states.find((state) => state.id === 'PT-03')?.health).toBe('Error');
    expect(states.find((state) => state.id === 'PT-07')?.health).toBe('Running');
  });
  it('依賴不存在不可啟用，有依賴正在運作不可停用', async () => {
    const definitions = moduleCatalog.map((definition) => definition.id === 'PT-07' ? { ...definition, dependencies: ['PT-03' as const] } : definition);
    const manager = new ModuleManager(repository, core.permissions, definitions);
    await expect(manager.setEnabled(actor(), 'PT-07', true)).rejects.toMatchObject({ code: 'DEPENDENCY_REQUIRED' });
    await manager.setEnabled(actor(), 'PT-03', true);
    await manager.setEnabled(actor(), 'PT-07', true);
    await expect(manager.setEnabled(actor(), 'PT-03', false)).rejects.toMatchObject({ code: 'DEPENDENT_RUNNING' });
  });
});
