import { beforeEach, expect, it, vi } from 'vitest';
import { createCore, type Core } from '../packages/core/src/index.js';
import { ModerationService, type ModerationTransport } from '../packages/core/src/moderation-service.js';
import type { ModerationCase, ModerationStore } from '../packages/database/src/moderation-repository.js';
import { MemoryRepository } from './helpers/memory-repository.js';
import { validateTarget, DiscordModerationTransport } from '../apps/bot/src/moderation-transport.js';
import { Collection, type Client } from 'discord.js';
import { PulseError } from '../packages/shared/src/errors.js';
import { commands } from '../apps/bot/src/commands.js';
const owner = '100000000000000001', moderator = '100000000000000002', guildId = '200000000000000001', targetId = '100000000000000003';
const actor = { userId: moderator, guildId, nativeAdministrator: false };
const request = { requestId: '400000000000000001', targetId, action: 'timeout', reason: 'test', confirmed: true, durationMinutes: 1 };
const record: ModerationCase = { id: '00000000-0000-4000-a000-000000000001', guildId, requestId: request.requestId, targetId, moderatorId: moderator, action: 'timeout', reason: 'test', status: 'Pending', relatedCaseId: null, channelId: null, durationMinutes: 1, requestedCount: null, affectedCount: null, errorCode: null, createdAt: new Date(), updatedAt: new Date() };
let repository: MemoryRepository, core: Core, store: ModerationStore, transport: ModerationTransport, service: ModerationService;
beforeEach(async () => {
  repository = new MemoryRepository(); core = createCore(repository, owner);
  await core.guilds.setAuthorization(owner, guildId, '測試', true);
  await core.guilds.setOperator(owner, guildId, moderator, 'moderator');
  await core.modules.setEnabled({ ...actor, userId: owner }, 'PT-04', true);
  store = { choices: vi.fn().mockResolvedValue([]), begin: vi.fn().mockResolvedValue({ record, created: true }), finish: vi.fn().mockImplementation(async (r, status, code, affected) => ({ ...r, status, errorCode: code, affectedCount: affected })), history: vi.fn().mockResolvedValue([]), detail: vi.fn().mockResolvedValue(record), notes: vi.fn().mockResolvedValue([]), note: vi.fn().mockResolvedValue(undefined) };
  transport = { authorize: vi.fn().mockResolvedValue(undefined), validate: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue(null) };
  service = new ModerationService(core, store, transport);
});
it('L2 可執行經確認案件，先保存再外部執行再寫成功', async () => {
  expect((await service.execute(actor, request)).status).toBe('Succeeded');
  expect(vi.mocked(store.begin).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(transport.execute).mock.invocationCallOrder[0]!);
  expect(vi.mocked(transport.execute).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(store.finish).mock.invocationCallOrder[0]!);
  await expect(core.configuration.view(actor)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
});
it('沒有內部權限、Lockdown、停用模組時不得執行 Discord API', async () => {
  await expect(service.execute({ ...actor, userId: targetId }, request)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  await repository.setLockdown(true, owner);
  await expect(service.execute(actor, request)).rejects.toMatchObject({ code: 'LOCKDOWN' });
  await repository.setLockdown(false, owner);
  await core.modules.setEnabled({ ...actor, userId: owner }, 'PT-04', false);
  await expect(service.execute(actor, request)).rejects.toMatchObject({ code: 'MODULE_UNAVAILABLE' });
  expect(transport.execute).not.toHaveBeenCalled(); expect(store.begin).not.toHaveBeenCalled();
});
it('拒絕未確認、超過 28 天、無關聯解除及不合法數量', async () => {
  for (const input of [{ ...request, confirmed: false }, { ...request, durationMinutes: 40321 }, { ...request, action: 'untimeout' }, { ...request, action: 'purge', count: 101 }]) await expect(service.execute(actor, input)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect(transport.execute).not.toHaveBeenCalled();
});
it('原生權限或階級拒絕不產生外部操作', async () => {
  vi.mocked(transport.validate).mockRejectedValue(new PulseError('PERMISSION_DENIED'));
  await expect(service.execute(actor, request)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  expect(store.begin).not.toHaveBeenCalled(); expect(transport.execute).not.toHaveBeenCalled();
});
it('相同指令案件不重做；DB 寫回失敗也不重試處分', async () => {
  vi.mocked(store.begin).mockResolvedValue({ record, created: false });
  expect(await service.execute(actor, request)).toEqual(record); expect(transport.execute).not.toHaveBeenCalled();
  vi.mocked(store.begin).mockResolvedValue({ record, created: true });
  vi.mocked(store.finish).mockRejectedValue(new Error('db failure'));
  await expect(service.execute(actor, request)).rejects.toThrow('db failure');
  expect(transport.execute).toHaveBeenCalledTimes(1); expect(store.finish).toHaveBeenCalledTimes(1);
});
it('Discord 明確拒絕為 Failed，未知結果為 Unknown，均不重試', async () => {
  vi.mocked(transport.execute).mockRejectedValueOnce({ code: 50013 }).mockRejectedValueOnce(new Error('secret-url'));
  expect((await service.execute(actor, request)).status).toBe('Failed');
  const result = await service.execute(actor, { ...request, requestId: '400000000000000002' });
  expect(result.status).toBe('Unknown'); expect(result.errorCode).toBe('ACTION_UNKNOWN');
});
it('讀取與備註仍檢查原生權限、Guild 授權及 UUID', async () => {
  vi.mocked(transport.authorize).mockRejectedValue(new PulseError('PERMISSION_DENIED'));
  await expect(service.history(actor, targetId)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  expect(store.history).not.toHaveBeenCalled();
  vi.mocked(transport.authorize).mockResolvedValue(undefined);
  await expect(service.note(actor, 'invalid', 'note')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await core.guilds.setAuthorization(owner, guildId, '測試', false);
  await expect(service.detail(actor, record.id)).rejects.toMatchObject({ code: 'GUILD_DENIED' });
});
it('案件選單需授權與有效對象，讀取及備註不能以其他對象的 ID 越過選擇', async () => {
  await service.choices(actor, targetId, '0000', 'timeout');
  expect(store.choices).toHaveBeenCalledWith(guildId, targetId, '0000', 'timeout');
  expect(await service.choices(actor, 'invalid', '')).toEqual([]);
  await expect(service.choices({ ...actor, userId: targetId }, targetId, '')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  await expect(service.detail(actor, record.id, owner)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(service.note(actor, record.id, 'note', owner)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect(store.note).not.toHaveBeenCalled();
});
it('Owner 原生階級限制不能繞過，目標與 Bot 階級檢查', () => {
  const a = { id: moderator, isGuildOwner: false, higherThanTarget: true }, b = { id: owner, higherThanTarget: true }, t = { id: targetId, isGuildOwner: false, isBot: false, administrator: false };
  expect(() => validateTarget(a, b, t, true)).not.toThrow();
  for (const [ma, mb, mt] of [[{ ...a, higherThanTarget: false }, b, t], [a, { ...b, higherThanTarget: false }, t], [a, b, { ...t, isGuildOwner: true }], [a, b, { ...t, administrator: true }], [a, b, { ...t, id: moderator }], [a, b, { ...t, isBot: true }]] as const) expect(() => validateTarget(ma, mb, mt, true)).toThrow(PulseError);
});
it('全部 Slash Commands 可序列化，管理指令都要求明確確認', () => {
  const definitions = commands.map((c) => c.toJSON());
  const mod = definitions.find((c) => c.name === 'mod')!;
  expect(mod.options).toHaveLength(11);
  for (const s of mod.options!.filter((o) => !['history','detail','note','notifications'].includes(o.name))) expect('options' in s && s.options?.some((o) => o.name === 'confirm' && 'required' in o && o.required)).toBe(true);
});
it('Purge 僅刪近期未釘選訊息，回傳實際數量，沒有舊訊息時不呼叫刪除', async () => {
  const messages = new Collection<string, { createdTimestamp: number; pinned: boolean }>([
    ['500000000000000001', { createdTimestamp: Date.now() - 10000, pinned: false }],
    ['500000000000000002', { createdTimestamp: Date.now() - 10000, pinned: true }],
    ['500000000000000003', { createdTimestamp: Date.now() - 15 * 86400000, pinned: false }],
  ]);
  const channel = { isTextBased: () => true, permissionsFor: () => ({ has: () => true }), messages: { fetch: vi.fn().mockResolvedValue(messages) }, bulkDelete: vi.fn().mockResolvedValue(new Collection([['500000000000000001', {}]])) };
  const guild = { members: { fetch: vi.fn().mockResolvedValue({ permissions: { has: () => true } }), fetchMe: vi.fn().mockResolvedValue({ id: owner, permissions: { has: () => true } }) }, channels: { fetch: vi.fn().mockResolvedValue(channel) } };
  const client = { guilds: { cache: { get: () => guild } } } as unknown as Client;
  const transport = new DiscordModerationTransport(client);
  const purge = { ...request, action: 'purge' as const, count: 3, channelId: '300000000000000001' };
  expect(await transport.execute(actor, purge, record.id)).toBe(1);
  expect([...channel.bulkDelete.mock.calls[0]![0].keys()]).toEqual(['500000000000000001']);
  messages.delete('500000000000000001');
  expect(await transport.execute(actor, purge, record.id)).toBe(0);
  expect(channel.bulkDelete).toHaveBeenCalledTimes(1);
});
