import { describe, expect, it, vi } from 'vitest';
import { EventRouter } from '../packages/core/src/event-router.js';
import { guildConfigurationSchema } from '../packages/shared/src/models.js';
import type { MessageEvent } from '../packages/shared/src/audit.js';
import { gatewayMessageEvents } from '../apps/bot/src/message-events.js';
const event: MessageEvent = { guildId: '200000000000000001', channelId: '300000000000000001', messageId: '400000000000000001', authorId: null, type: 'message.create', content: 'sensitive', eventKey: 'create:1', partial: false, receivedAt: new Date(), eventAt: null };
describe('Audit 政策與 EventRouter', () => {
  it('Gateway 缺少更新內容保持 Unavailable；DM、Bot 與無關事件不進入佇列', () => {
    const payload = { guild_id: event.guildId, channel_id: event.channelId, id: event.messageId };
    expect(gatewayMessageEvents('MESSAGE_UPDATE', payload)[0]).toMatchObject({ content: null, partial: true, eventAt: null });
    expect(gatewayMessageEvents('MESSAGE_CREATE', { ...payload, author: { id: event.guildId, bot: true } })).toEqual([]);
    expect(gatewayMessageEvents('MESSAGE_CREATE', { channel_id: event.channelId, id: event.messageId })).toEqual([]);
    expect(gatewayMessageEvents('PRESENCE_UPDATE', payload)).toEqual([]);
    expect(gatewayMessageEvents('MESSAGE_DELETE_BULK', { ...payload, ids: [event.messageId, '400000000000000002'] })).toHaveLength(2);
  });
  it('舊設定補上安全預設，啟用原文須頻道及非空隱私告知', () => {
    expect(guildConfigurationSchema.parse({}).capture).toMatchObject({ enabled: false, viewerIds: [], privacyNotice: '' });
    expect(guildConfigurationSchema.safeParse({ capture: { enabled: true } }).success).toBe(false);
    expect(guildConfigurationSchema.safeParse({ capture: { enabled: true, allowedChannels: [event.channelId], privacyNotice: ' ' } }).success).toBe(false);
  });
  it('同訊息事件序列處理，shutdown 等待且拒絕新事件', async () => {
    const order: string[] = [];
    const router = new EventRouter(async (value) => { await new Promise((resolve) => setTimeout(resolve, 5)); order.push(value.eventKey); }, vi.fn());
    const first = router.dispatch(event);
    const second = router.dispatch({ ...event, eventKey: 'update:2' });
    await router.shutdown();
    await Promise.all([first, second]);
    await router.dispatch({ ...event, eventKey: 'delete:3' });
    expect(order).toEqual(['create:1', 'update:2']);
  });
  it('瞬間交易錯誤有限重試；失敗只輸出安全代碼', async () => {
    const consume = vi.fn().mockRejectedValueOnce({ cause: { code: '40001', detail: event.content } }).mockResolvedValue(undefined);
    const error = vi.fn();
    const router = new EventRouter(consume, error);
    await router.dispatch(event);
    expect(consume).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
    const failed = new EventRouter(async () => { throw new Error(event.content!); }, error);
    await failed.dispatch(event);
    expect(error).toHaveBeenCalledWith('AUDIT_WRITE_FAILED');
  });
  it('有界佇列防止無限制保留訊息原文', async () => {
    const error = vi.fn();
    const router = new EventRouter(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }, error, 1);
    const first = router.dispatch(event);
    await router.dispatch({ ...event, messageId: '400000000000000002' });
    await first;
    expect(error).toHaveBeenCalledWith('AUDIT_QUEUE_FULL');
  });
});
