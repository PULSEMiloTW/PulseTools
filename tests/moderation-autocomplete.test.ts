import { expect, it, vi } from 'vitest';
import type { AutocompleteInteraction } from 'discord.js';
import { handleModerationAutocomplete } from '../apps/bot/src/moderation-autocomplete.js';
import type { ModerationService } from '../packages/core/src/moderation-service.js';
function interaction(sub = 'untimeout', focused = 'related_case_id', selected: string | undefined = '100000000000000003') {
  return { guildId: '200000000000000001', commandName: 'mod', user: { id: '100000000000000002' }, memberPermissions: { has: () => false }, responded: false,
    options: { getFocused: () => ({ name: focused, value: '' }), getSubcommand: () => sub, get: vi.fn().mockReturnValue(selected === undefined ? null : { value: selected }) }, respond: vi.fn().mockResolvedValue(undefined) } as unknown as AutocompleteInteraction;
}
it('選完人後顯示完整 UUID、操作與 Guild 時區時間，值仍是 UUID且不洩漏原因', async () => {
  const id = '00000000-0000-4000-a000-000000000001';
  const choices = vi.fn().mockResolvedValue({ records: [{ id, action: 'timeout', createdAt: new Date('2026-10-09T12:00:00Z'), status: 'Succeeded', reason: 'private-reason' }], timezone: 'Asia/Taipei' });
  const i = interaction(); await handleModerationAutocomplete(i, { choices } as unknown as ModerationService);
  expect(choices).toHaveBeenCalledWith(expect.objectContaining({ guildId: i.guildId }), '100000000000000003', '', 'timeout');
  const options = vi.mocked(i.respond).mock.calls[0]![0];
  expect(options[0]?.value).toBe(id); expect(options[0]?.name).toContain(id); expect(options[0]?.name).toContain('20:00:00');
  expect(options[0]?.name).toContain('Asia/Taipei'); expect(JSON.stringify(options)).not.toContain('private-reason');
});
it('解除封鎖依 user_id 篩選；detail／note 顯示同對象所有案件類型', async () => {
  const choices = vi.fn().mockResolvedValue({ records: [], timezone: 'UTC' });
  for (const [sub, focused, action] of [['unban','related_case_id','ban'], ['detail','case_id',undefined], ['note','case_id',undefined]] as const) {
    const i = interaction(sub, focused); await handleModerationAutocomplete(i, { choices } as unknown as ModerationService);
    expect(choices).toHaveBeenLastCalledWith(expect.anything(), '100000000000000003', '', action);
    expect(i.options.get).toHaveBeenCalledWith(sub === 'unban' ? 'user_id' : 'user');
  }
});
it('缺少對象或授權拒絕只回空選單，最多 25 筆且標籤最多 100 字', async () => {
  const choices = vi.fn().mockRejectedValue(new Error('private failure'));
  const missing = interaction('untimeout', 'related_case_id', undefined);
  // 顯式清空 option，避免函式預設參數填回測試對象。
  vi.mocked(missing.options.get).mockReturnValue(null);
  await handleModerationAutocomplete(missing, { choices } as unknown as ModerationService);
  expect(choices).not.toHaveBeenCalled(); expect(missing.respond).toHaveBeenCalledWith([]);
  const denied = interaction(); await handleModerationAutocomplete(denied, { choices } as unknown as ModerationService); expect(denied.respond).toHaveBeenCalledWith([]);
  choices.mockResolvedValue({ records: Array.from({ length: 30 }, () => ({ id: '00000000-0000-4000-a000-000000000001', action: 'timeout', status: 'Succeeded', createdAt: new Date() })), timezone: 'America/Argentina/Buenos_Aires' });
  const filled = interaction(); await handleModerationAutocomplete(filled, { choices } as unknown as ModerationService);
  const values = vi.mocked(filled.respond).mock.calls[0]![0]; expect(values).toHaveLength(25); expect(values.every((o) => o.name.length <= 100)).toBe(true);
});
