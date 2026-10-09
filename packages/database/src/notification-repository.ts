import { and, eq, lte, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { guildConfigurationSchema } from '../../shared/src/models.js';
import { notificationChannel, notificationPayloadSchema, type NotificationPayload } from '../../shared/src/server-events.js';
import { guilds, moduleStates, notificationOutbox } from './schema.js';
import { randomUUID } from 'node:crypto';
import type { EventMetadata } from '../../shared/src/server-events.js';
import { PulseError } from '../../shared/src/errors.js';
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type NotificationJob = typeof notificationOutbox.$inferSelect;
export async function enqueueNotification(tx: Transaction, input: { guildId: string; moduleId: 'PT-01' | 'PT-02'; eventKey: string; channelId: string; payload: NotificationPayload; expiresAt: Date }) {
  await tx.insert(notificationOutbox).values({ ...input, payload: notificationPayloadSchema.parse(input.payload) }).onConflictDoNothing();
}
export class PostgresNotificationRepository {
  constructor(private readonly db: Database) {}
  async test(guildId: string, moduleId: 'PT-01' | 'PT-02', type: NotificationPayload['eventType'], metadata: EventMetadata) {
    return this.db.transaction(async (tx) => {
      const [guild] = await tx.select().from(guilds).where(eq(guilds.id, guildId)).for('share');
      if (!guild?.authorized) throw new PulseError('GUILD_DENIED');
      const [module] = await tx.select().from(moduleStates).where(and(eq(moduleStates.guildId, guildId), eq(moduleStates.moduleId, moduleId))).for('share');
      if (!module?.enabled) throw new PulseError('MODULE_UNAVAILABLE');
      const policy = guildConfigurationSchema.parse(guild.configuration);
      const channelId = notificationChannel(policy, moduleId, type);
      if (!channelId || (moduleId === 'PT-01' && !policy.audit.enabledEvents.includes(type))) throw new PulseError('INVALID_INPUT');
      const now = new Date();
      await enqueueNotification(tx, { guildId, moduleId, channelId, eventKey: `test:${randomUUID()}`,
        payload: { eventType: type, entityId: metadata.userId ?? guildId, sourceChannelId: null, eventAt: now.toISOString(), timestampSource: 'received', metadata, isTest: true }, expiresAt: new Date(now.getTime() + policy.audit.retentionDays * 86400000) });
      return channelId;
    });
  }
  async claim(now = new Date()) {
    return this.db.transaction(async (tx) => {
      const [job] = await tx.select().from(notificationOutbox).where(and(eq(notificationOutbox.status, 'Pending'), lte(notificationOutbox.nextAttemptAt, now)))
        .orderBy(notificationOutbox.createdAt).limit(1).for('update', { skipLocked: true });
      if (!job) return undefined;
      const [claimed] = await tx.update(notificationOutbox).set({ status: 'Sending', attempts: job.attempts + 1, leaseAt: now, updatedAt: now }).where(eq(notificationOutbox.id, job.id)).returning();
      return claimed;
    });
  }
  async configuration(job: NotificationJob) {
    const [guild] = await this.db.select().from(guilds).where(eq(guilds.id, job.guildId));
    if (!guild?.authorized || job.expiresAt <= new Date()) return undefined;
    const [module] = await this.db.select().from(moduleStates).where(and(eq(moduleStates.guildId, job.guildId), eq(moduleStates.moduleId, job.moduleId)));
    if (!module?.enabled) return undefined;
    const policy = guildConfigurationSchema.parse(guild.configuration);
    if (job.createdAt.getTime() <= Date.now() - policy.audit.retentionDays * 86400000 || (job.moduleId === 'PT-01' && !policy.audit.enabledEvents.includes(job.payload.eventType))) return undefined;
    return notificationChannel(policy, job.moduleId, job.payload.eventType) === job.channelId ? policy : undefined;
  }
  async sent(job: NotificationJob, messageId: string) {
    await this.db.update(notificationOutbox).set({ status: 'Sent', sentMessageId: messageId, errorCode: null, leaseAt: null, updatedAt: new Date() }).where(and(eq(notificationOutbox.id, job.id), eq(notificationOutbox.status, 'Sending')));
  }
  async cancel(job: NotificationJob) {
    await this.db.update(notificationOutbox).set({ status: 'Cancelled', leaseAt: null, updatedAt: new Date() }).where(and(eq(notificationOutbox.id, job.id), eq(notificationOutbox.status, 'Sending')));
  }
  async fail(job: NotificationJob, code: string, retry: boolean) {
    await this.db.update(notificationOutbox).set({ status: retry && job.attempts < 3 ? 'Pending' : 'Failed', errorCode: code, leaseAt: null,
      nextAttemptAt: new Date(Date.now() + Math.min(60000, 1000 * 2 ** job.attempts)), updatedAt: new Date() }).where(and(eq(notificationOutbox.id, job.id), eq(notificationOutbox.status, 'Sending')));
  }
  async recover() {
    // Sending 可能已成功發送但未寫回；重啟後不能假定可安全重送。
    await this.db.update(notificationOutbox).set({ status: 'Failed', errorCode: 'DELIVERY_UNKNOWN', leaseAt: null, updatedAt: new Date() }).where(eq(notificationOutbox.status, 'Sending'));
  }
  async status(guildId: string) {
    return this.db.select({ status: notificationOutbox.status, count: sql<number>`count(*)::int` }).from(notificationOutbox).where(eq(notificationOutbox.guildId, guildId)).groupBy(notificationOutbox.status);
  }
  async failures(guildId: string) {
    return this.db.select({ id: notificationOutbox.id, channelId: notificationOutbox.channelId, errorCode: notificationOutbox.errorCode }).from(notificationOutbox).where(and(eq(notificationOutbox.guildId, guildId), eq(notificationOutbox.status, 'Failed'))).orderBy(sql`${notificationOutbox.updatedAt} desc`).limit(5);
  }
}
