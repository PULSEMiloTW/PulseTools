import { beforeEach, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { handleCommand } from '../apps/bot/src/interaction-handler.js';
import { createCore } from '../packages/core/src/index.js';
import { MemoryRepository } from './helpers/memory-repository.js';
import type { PostgresNotificationRepository } from '../packages/database/src/notification-repository.js';

const owner = '100000000000000001';
const guild = '200000000000000001';
let repository: MemoryRepository;
beforeEach(() => { repository = new MemoryRepository(); });
function interaction(userId: string, command = 'config', sub = 'view') {
  const fixture = { guildId: guild, user: { id: userId }, commandName: command, memberPermissions: { has: () => true },
    options: { getSubcommand: () => sub, getSubcommandGroup: () => null },
    deferred: true, replied: false, deferReply: vi.fn(async (_payload: unknown) => {}), editReply: vi.fn(async (_payload: unknown) => {}), reply: vi.fn(async (_payload: unknown) => {}) };
  return { fixture, value: fixture as unknown as ChatInputCommandInteraction };
}
function runtime() {
  return { startedAt: new Date(), client: {} as Client, core: createCore(repository, owner) };
}
it('未授權 Guild 使用 Ephemeral 拒絕且不產生活動資料', async () => {
  const test = interaction(owner);
  await handleCommand(test.value, runtime());
  expect(test.fixture.deferReply).toHaveBeenCalledWith({ flags: 64 });
  const payload = test.fixture.editReply.mock.calls[0]?.[0] as unknown as { embeds: { toJSON(): { description: string } }[] };
  expect(payload.embeds[0]?.toJSON().description).toContain('尚未獲得');
  expect(repository.events).toHaveLength(0);
});
it('非 Owner 的 Owner 指令被拒絕', async () => {
  const test = interaction('100000000000000002', 'owner', 'status');
  await handleCommand(test.value, runtime());
  expect(repository.events).toHaveLength(0);
  expect(test.fixture.editReply).toHaveBeenCalledTimes(1);
});
it('Discord 回覆失敗不造成未捕捉的 Promise 拒絕', async () => {
  const test = interaction(owner);
  test.fixture.editReply.mockRejectedValue(new Error('Token-never-print'));
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await expect(handleCommand(test.value, runtime())).resolves.toBeUndefined();
    expect(consoleSpy.mock.calls.flat().join(' ')).not.toContain('Token-never-print');
  } finally { consoleSpy.mockRestore(); }
});
it('Welcome 公開測試受 Lockdown 阻擋，不排入發送佇列', async () => {
  const state = runtime();
  await state.core.guilds.setAuthorization(owner, guild, '離線測試 Guild', true);
  await state.core.modules.setEnabled({ userId: owner, guildId: guild, nativeAdministrator: true }, 'PT-02', true);
  await repository.setLockdown(true, owner);
  const queued = vi.fn();
  const test = interaction(owner, 'welcome', 'test');
  Object.assign(test.fixture.options, { getString: () => 'join' });
  await handleCommand(test.value, { ...state, memberEventsEnabled: true, notifications: { test: queued } as unknown as PostgresNotificationRepository });
  expect(queued).not.toHaveBeenCalled();
  expect((await repository.guild(guild))?.revision).toBe(0);
});
it('非內部管理員不能藉 Welcome 指令對外排入測試通知', async () => {
  const state = runtime();
  await state.core.guilds.setAuthorization(owner, guild, '離線測試 Guild', true);
  const queued = vi.fn();
  const test = interaction('100000000000000002', 'welcome', 'test');
  await handleCommand(test.value, { ...state, notifications: { test: queued } as unknown as PostgresNotificationRepository });
  expect(queued).not.toHaveBeenCalled();
});
