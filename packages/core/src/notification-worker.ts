import type { PostgresNotificationRepository, NotificationJob } from '../../database/src/notification-repository.js';
import type { GuildConfiguration } from '../../shared/src/models.js';
import { notificationPayloadSchema } from '../../shared/src/server-events.js';
import { allowedMentions, pulseEmbed } from '../../embed-system/src/index.js';
import { formatTimestamp } from '../../shared/src/timestamp.js';
const titles: Record<string, string> = {
  'moderation.case': '管理案件', 'error.record': '系統異常紀錄',
  'member.join': '成員加入', 'member.leave': '成員離開', 'member.update': '成員資料更新（舊資料不可用）', 'member.nickname': '暱稱更新', 'member.role.add': '成員身分組新增', 'member.role.remove': '成員身分組移除',
  'voice.join': '加入語音', 'voice.leave': '離開語音', 'voice.switch': '切換語音頻道',
  'message.create': '訊息建立', 'message.update': '訊息編輯', 'message.delete': '訊息刪除',
  'role.create': '身分組建立', 'role.update': '身分組更新', 'role.delete': '身分組刪除', 'role.permissions': '身分組權限更新',
  'channel.create': '頻道建立', 'channel.update': '頻道更新', 'channel.delete': '頻道刪除', 'channel.permissions': '頻道權限覆寫更新',
  'guild.update': '伺服器設定更新', 'invite.create': '邀請建立', 'invite.delete': '邀請刪除',
};
export function notificationEmbed(job: Pick<NotificationJob, 'id' | 'moduleId' | 'payload'>, configuration: GuildConfiguration) {
  const payload = notificationPayloadSchema.parse(job.payload);
  const data = payload.metadata;
  const account = data.accountCreatedAt ? formatTimestamp(new Date(data.accountCreatedAt), configuration.timezone) : 'Unavailable';
  const values: Record<string, string> = { guild: data.guildName ?? 'Unavailable', user: data.userName ?? 'Unavailable', user_id: data.userId ?? payload.entityId, count: data.memberCount?.toString() ?? 'Unavailable', account_created: account };
  const template = job.moduleId === 'PT-02' ? payload.eventType === 'member.join' ? configuration.welcome.joinMessage : configuration.welcome.leaveMessage : '';
  const welcome = template.replace(/\{(guild|user|user_id|count|account_created)\}/g, (_match, key: string) => values[key] ?? 'Unavailable');
  const description = [welcome, data.guildName ? `伺服器：${data.guildName}` : '', data.userName ? `成員：${data.userName}` : '',
    `對象 ID：${payload.entityId}`, data.entityName ? `名稱：${data.entityName}` : '',
    payload.sourceChannelId ? `來源頻道 ID：${payload.sourceChannelId}` : '',
    data.memberCount !== undefined ? `目前成員總人數：${values.count}` : '',
    configuration.welcome.showAccountCreated && job.moduleId === 'PT-02' ? `帳號建立：${account}` : '',
    data.before !== undefined ? `變更前：${data.before}` : '', data.after !== undefined ? `變更後：${data.after}` : '',
    `時間：${formatTimestamp(new Date(payload.eventAt), configuration.timezone)}（${configuration.timezone}）`,
    `時間來源：${payload.timestampSource}`, data.moderatorId ? `操作者 ID：${data.moderatorId}` : payload.eventType === 'member.leave' ? '離開原因：無法確認' : '操作者：無法確認',
    `紀錄 ID：${job.id}`].filter(Boolean).join('\n');
  return pulseEmbed({ title: `${payload.isTest ? '【測試通知】' : ''}${titles[payload.eventType] ?? payload.eventType}`, description, timestamp: new Date(payload.eventAt),
    kind: job.moduleId === 'PT-04' ? 'moderation' : job.moduleId === 'PT-08' ? 'error' : payload.eventType === 'member.join' ? 'memberJoin' : payload.eventType === 'member.leave' ? 'memberLeave' : payload.eventType.startsWith('voice.') ? 'voice' : 'information',
    ...(data.avatar ? { thumbnail: data.avatar } : {}) });
}
export type NotificationStore = Pick<PostgresNotificationRepository, 'claim' | 'configuration' | 'sent' | 'cancel' | 'fail'>;
export class NotificationWorker {
  private operation: Promise<void> | undefined;
  private stopped = false;
  constructor(private readonly repository: NotificationStore,
    private readonly deliver: (job: NotificationJob, message: { embeds: ReturnType<typeof pulseEmbed>[]; allowedMentions: typeof allowedMentions }) => Promise<string>,
    private readonly enabled: (job: NotificationJob) => Promise<boolean>, private readonly ready: () => boolean,
    private readonly onFailure?: (job: NotificationJob) => Promise<void>) {}
  flush(): Promise<void> {
    if (this.stopped || !this.ready()) return Promise.resolve();
    if (this.operation) return this.operation;
    this.operation = this.process().finally(() => { this.operation = undefined; });
    return this.operation;
  }
  private async process() {
    for (let index = 0; index < 10 && !this.stopped && this.ready(); index++) {
      const job = await this.repository.claim();
      if (!job) return;
      const policy = await this.repository.configuration(job);
      if (!policy || !(await this.enabled(job))) { await this.repository.cancel(job); continue; }
      let messageId: string;
      try {
        messageId = await this.deliver(job, { embeds: [notificationEmbed(job, policy)], allowedMentions });
      } catch (error) {
        const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        const known = ['50001', '50013', '10003'].includes(code);
        await this.repository.fail(job, known ? 'CHANNEL_UNAVAILABLE' : status === 429 || status >= 500 ? 'DISCORD_RETRYABLE' : 'DELIVERY_UNKNOWN', !known && (status === 429 || status >= 500));
        if (this.onFailure) await this.onFailure(job);
        continue;
      }
      // Sent 寫回失敗時保持 Sending，不能重送已發出的通知。
      await this.repository.sent(job, messageId);
    }
  }
  async shutdown() { this.stopped = true; await this.operation; }
}
