import { and, desc, eq, lte, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { auditEvents, guilds, messageSnapshots, messageVersions, moduleStates, notificationOutbox, serverEvents, r2UploadRequests } from './schema.js';
import { enqueueNotification } from './notification-repository.js';
import { guildConfigurationSchema } from '../../shared/src/models.js';
import { messageEventSchema, type CaptureStatus, type MessageEvent } from '../../shared/src/audit.js';

const expiry = (at: Date, days: number) => new Date(at.getTime() + days * 86400000);
export class PostgresAuditRepository {
  constructor(private readonly db: Database) {}
  async ingest(input: MessageEvent): Promise<'stored' | 'duplicate' | 'ignored'> {
    const event = messageEventSchema.parse(input);
    return this.db.transaction(async (tx) => {
      // 與設定更新、撤銷授權及停用模組互斥，使用處理當下的政策。
      const [guild] = await tx.select().from(guilds).where(eq(guilds.id, event.guildId)).for('share');
      if (!guild?.authorized) return 'ignored';
      const [module] = await tx.select().from(moduleStates).where(and(eq(moduleStates.guildId, event.guildId), eq(moduleStates.moduleId, 'PT-01'))).for('share');
      const policy = guildConfigurationSchema.parse(guild.configuration);
      if (!module?.enabled || !policy.audit.enabledEvents.includes(event.type)) return 'ignored';
      // 通知輸出頻道排除訊息捕捉，避免無作者資訊的 Embed 更新及刪除造成回授。
      if ([...Object.values(policy.channels), policy.welcome.joinChannel, policy.welcome.leaveChannel].includes(event.channelId)) return 'ignored';
      const now = new Date();
      let uploadRequestId: string | null = null;
      if(event.type==='message.delete') {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.guildId}),hashtext(${event.messageId}))`);
        const [upload]=await tx.select({id:r2UploadRequests.id}).from(r2UploadRequests).where(and(eq(r2UploadRequests.guildId,event.guildId),eq(r2UploadRequests.messageId,event.messageId),sql`${r2UploadRequests.deletedAt} is not null`));
        uploadRequestId=upload?.id??null;
      }
      const [inserted] = await tx.insert(auditEvents).values({
        guildId: event.guildId, channelId: event.channelId, messageId: event.messageId, uploadRequestId,
        authorId: event.authorId, eventType: event.type, eventKey: event.eventKey,
        eventAt: event.eventAt ?? event.receivedAt, receivedAt: event.receivedAt,
        timestampSource: event.eventAt ? 'discord' : 'received', captureStatus: 'Unavailable',
        expiresAt: expiry(event.receivedAt, policy.audit.retentionDays),
      }).onConflictDoNothing().returning({ id: auditEvents.id });
      if (!inserted) return 'duplicate';
      const logChannel = policy.channels.message;
      if (logChannel) await enqueueNotification(tx, { guildId: event.guildId, moduleId: 'PT-01', eventKey: event.eventKey, channelId: logChannel,
        payload: { eventType: event.type, entityId: event.messageId, sourceChannelId: event.channelId, eventAt: (event.eventAt ?? event.receivedAt).toISOString(), timestampSource: event.eventAt ? 'discord' : 'received', metadata: event.authorId ? { userId: event.authorId } : {} }, expiresAt: expiry(event.receivedAt, policy.audit.retentionDays) });
      const capture = policy.capture;
      if (!capture.enabled || !capture.allowedChannels.includes(event.channelId) || capture.excludedChannels.includes(event.channelId)) return 'stored';
      const createdAt = event.messageCreatedAt ?? event.eventAt ?? event.receivedAt;
      const deadline = expiry(createdAt, capture.retentionDays);
      if (deadline <= now) return 'stored';
      await tx.insert(messageSnapshots).values({
        guildId: event.guildId, channelId: event.channelId, messageId: event.messageId,
        authorId: event.authorId, captureStatus: 'Unavailable',
        createdAt, updatedAt: event.eventAt ?? event.receivedAt, expiresAt: deadline,
      }).onConflictDoNothing();
      const condition = and(eq(messageSnapshots.guildId, event.guildId), eq(messageSnapshots.messageId, event.messageId));
      const [saved] = await tx.select().from(messageSnapshots).where(condition).for('update');
      if (!saved || saved.expiresAt <= now) return 'stored';
      // 刪除事件只能引用先前實際保存的內容；不能把快取或後續 fetch 當原文。
      const content = event.type === 'message.delete' ? saved.latestContent : event.content;
      const status: CaptureStatus = content === null ? 'Unavailable'
        : event.type === 'message.delete' ? (saved.captureStatus === 'Unavailable' ? 'Partial' : saved.captureStatus)
        : event.partial || (saved.originalContent === null && event.type !== 'message.create') ? 'Partial' : 'Captured';
      const at = event.eventAt ?? event.receivedAt;
      const revision = saved.revision + 1;
      await tx.insert(messageVersions).values({ guildId: event.guildId, messageId: event.messageId, revision,
        content, captureStatus: status, eventType: event.type, eventAt: at, receivedAt: event.receivedAt, expiresAt: saved.expiresAt });
      const latest = at >= saved.updatedAt && !saved.deletedAt;
      await tx.update(messageSnapshots).set({
        revision,
        originalContent: event.type === 'message.create' && !event.partial ? (saved.originalContent ?? content) : saved.originalContent,
        latestContent: latest && event.type !== 'message.delete' && content !== null ? content : saved.latestContent,
        captureStatus: latest ? status : saved.captureStatus,
        authorId: saved.authorId ?? event.authorId,
        updatedAt: latest ? at : saved.updatedAt,
        deletedAt: event.type === 'message.delete' ? (saved.deletedAt ?? at) : saved.deletedAt,
        expiresAt: new Date(Math.min(saved.expiresAt.getTime(), deadline.getTime())),
      }).where(condition);
      await tx.update(auditEvents).set({ captureStatus: status }).where(eq(auditEvents.id, inserted.id));
      return 'stored';
    });
  }
  async recent(guildId: string) {
    const [guild] = await this.db.select().from(guilds).where(eq(guilds.id, guildId));
    if (!guild?.authorized) return [];
    const policy = guildConfigurationSchema.parse(guild.configuration);
    return this.db.select().from(auditEvents).where(and(eq(auditEvents.guildId, guildId), sql`${auditEvents.expiresAt} > now()`, sql`${auditEvents.receivedAt} > ${new Date(Date.now() - policy.audit.retentionDays * 86400000)}`)).orderBy(desc(auditEvents.receivedAt)).limit(10);
  }
  async snapshot(guildId: string, messageId: string) {
    const [guild] = await this.db.select().from(guilds).where(eq(guilds.id, guildId));
    if (!guild?.authorized) return undefined;
    const policy = guildConfigurationSchema.parse(guild.configuration);
    const [snapshot] = await this.db.select().from(messageSnapshots).where(and(eq(messageSnapshots.guildId, guildId), eq(messageSnapshots.messageId, messageId), sql`${messageSnapshots.expiresAt} > now()`, sql`${messageSnapshots.createdAt} > ${new Date(Date.now() - policy.capture.retentionDays * 86400000)}`));
    if (!snapshot) return undefined;
    const versions = await this.db.select().from(messageVersions).where(and(eq(messageVersions.guildId, guildId), eq(messageVersions.messageId, messageId), sql`${messageVersions.expiresAt} > now()`)).orderBy(desc(messageVersions.revision)).limit(10);
    return { snapshot, versions };
  }
  async prune(now = new Date()) {
    // 撤銷授權後仍執行資料最小化；不收集新事件。
    for (const guild of await this.db.select().from(guilds)) {
      const policy = guildConfigurationSchema.parse(guild.configuration);
      await this.db.transaction(async (tx) => {
        await tx.delete(auditEvents).where(and(eq(auditEvents.guildId, guild.id), sql`(${auditEvents.expiresAt} <= ${now} or ${auditEvents.receivedAt} <= ${new Date(now.getTime() - policy.audit.retentionDays * 86400000)})`));
        await tx.delete(messageSnapshots).where(and(eq(messageSnapshots.guildId, guild.id), sql`(${messageSnapshots.expiresAt} <= ${now} or ${messageSnapshots.createdAt} <= ${new Date(now.getTime() - policy.capture.retentionDays * 86400000)})`));
        await tx.delete(messageVersions).where(lte(messageVersions.expiresAt, now));
        const cutoff = new Date(now.getTime() - policy.audit.retentionDays * 86400000);
        await tx.delete(serverEvents).where(and(eq(serverEvents.guildId, guild.id), sql`(${serverEvents.expiresAt} <= ${now} or ${serverEvents.receivedAt} <= ${cutoff})`));
        await tx.delete(notificationOutbox).where(and(eq(notificationOutbox.guildId, guild.id), sql`(${notificationOutbox.expiresAt} <= ${now} or ${notificationOutbox.createdAt} <= ${cutoff})`));
      });
    }
  }
}
