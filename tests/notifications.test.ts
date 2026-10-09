import { expect, it, vi } from 'vitest';
import { memberDifferences, voiceTransition } from '../apps/bot/src/server-events.js';
import { NotificationWorker, notificationEmbed, type NotificationStore } from '../packages/core/src/notification-worker.js';
import { guildConfigurationSchema } from '../packages/shared/src/models.js';
import { notificationPayloadSchema } from '../packages/shared/src/server-events.js';
import type { NotificationJob } from '../packages/database/src/notification-repository.js';
const policy = guildConfigurationSchema.parse({ welcome: { joinMessage: '@everyone 歡迎 {user} 加入 {guild}，人數 {count}' } });
function job(): NotificationJob {
  return { id: '00000000-0000-4000-a000-000000000001', guildId: '200000000000000001', moduleId: 'PT-02', eventKey: 'join:1', channelId: '300000000000000001',
    payload: { eventType: 'member.join', entityId: '100000000000000001', sourceChannelId: null, eventAt: new Date().toISOString(), timestampSource: 'received', metadata: { userName: '@here **name**', guildName: '測試 Guild', memberCount: 65 }, isTest: true },
    status: 'Sending', attempts: 1, nextAttemptAt: new Date(), leaseAt: new Date(), sentMessageId: null, errorCode: null, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 86400000) };
}
function store(value = job()): NotificationStore {
  return { claim: vi.fn().mockResolvedValueOnce(value).mockResolvedValue(undefined), configuration: vi.fn().mockResolvedValue(policy), sent: vi.fn().mockResolvedValue(undefined), cancel: vi.fn().mockResolvedValue(undefined), fail: vi.fn().mockResolvedValue(undefined) };
}
it('事件差異不依角色順序產生假更新，語音靜音不當作切換', () => {
  expect(memberDifferences({ nickname: null, roles: ['1','2'] }, { nickname: null, roles: ['2','1'] })).toEqual([]);
  expect(memberDifferences({ nickname: null, roles: ['1'] }, { nickname: 'new', roles: ['2'] }).map((value) => value.type)).toEqual(['member.nickname', 'member.role.add', 'member.role.remove']);
  expect(voiceTransition(null, '1')).toBe('voice.join');
  expect(voiceTransition('1', '2')).toBe('voice.switch');
  expect(voiceTransition('1', null)).toBe('voice.leave');
  expect(voiceTransition('1', '1')).toBeUndefined();
});
it('通知有真實時間、品牌、色彩、測試標記、成員總數且不能觸發 mention', () => {
  const embed = notificationEmbed(job(), policy).toJSON();
  expect(embed.title).toContain('測試通知');
  expect(embed.color).toBe(0x10b981);
  expect(embed.footer?.text).toBe('Powered by Pulse Studio');
  expect(embed.description).toContain('65');
  expect(embed.description).not.toContain('@everyone');
  expect(embed.description).not.toContain('@here');
  const leave = job(); leave.payload.eventType = 'member.leave';
  expect(notificationEmbed(leave, policy).toJSON().description).toContain('離開原因：無法確認');
});
it('通知 Payload Schema 拒絕原文及未知欄位', () => {
  expect(notificationPayloadSchema.safeParse({ ...job().payload, content: 'private-original' }).success).toBe(false);
  expect(notificationPayloadSchema.safeParse({ ...job().payload, metadata: { ...job().payload.metadata, token: 'private-secret' } }).success).toBe(false);
});
it('Worker 單次發送並保存實際訊息 ID，同時 flush 不重複處理', async () => {
  const repository = store();
  const deliver = vi.fn().mockResolvedValue('500000000000000001');
  const worker = new NotificationWorker(repository, deliver, async () => true, () => true);
  await Promise.all([worker.flush(), worker.flush()]);
  expect(deliver).toHaveBeenCalledTimes(1);
  expect(repository.sent).toHaveBeenCalledWith(expect.anything(), '500000000000000001');
  expect(deliver.mock.calls[0]?.[1].allowedMentions).toEqual({ parse: [], repliedUser: false });
});
it('撤銷授權、停用模組或修改路由時取消，未就緒不取任務', async () => {
  const repository = store(); const deliver = vi.fn();
  await new NotificationWorker(repository, deliver, async () => false, () => true).flush();
  expect(deliver).not.toHaveBeenCalled(); expect(repository.cancel).toHaveBeenCalledTimes(1);
  const waiting = store(); await new NotificationWorker(waiting, deliver, async () => true, () => false).flush();
  expect(waiting.claim).not.toHaveBeenCalled();
  const denied = store(); vi.mocked(denied.configuration).mockResolvedValue(undefined);
  await new NotificationWorker(denied, deliver, async () => true, () => true).flush();
  expect(denied.cancel).toHaveBeenCalledTimes(1);
});
it('Discord 限流可有限重試，失去權限及結果不明不盲目重送', async () => {
  for (const [error, code, retry] of [[{ status: 429 }, 'DISCORD_RETRYABLE', true], [{ code: 50013 }, 'CHANNEL_UNAVAILABLE', false], [new Error('secret-never-print'), 'DELIVERY_UNKNOWN', false]] as const) {
    const repository = store();
    await new NotificationWorker(repository, async () => { throw error; }, async () => true, () => true).flush();
    expect(repository.fail).toHaveBeenCalledWith(expect.anything(), code, retry);
    expect(repository.sent).not.toHaveBeenCalled();
  }
});
it('發送後 DB 寫回失敗保留 Sending；不重送成功通知', async () => {
  const repository = store(); vi.mocked(repository.sent).mockRejectedValue(new Error('write-failed'));
  const deliver = vi.fn().mockResolvedValue('500000000000000001');
  await expect(new NotificationWorker(repository, deliver, async () => true, () => true).flush()).rejects.toThrow('write-failed');
  expect(deliver).toHaveBeenCalledTimes(1); expect(repository.fail).not.toHaveBeenCalled();
});
