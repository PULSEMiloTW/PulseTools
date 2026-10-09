import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { errorRecords, guilds, healthSamples, moduleStates } from './schema.js';
import { errorInputSchema, healthMetricsSchema, type ErrorInput, type HealthMetrics } from '../../shared/src/monitoring.js';
import { guildConfigurationSchema } from '../../shared/src/models.js';
import { enqueueNotification } from './notification-repository.js';
import { PulseError } from '../../shared/src/errors.js';
export class PostgresMonitoringRepository {
  constructor(private readonly db: Database) {}
  async health() {
    await this.db.select({ id: errorRecords.id }).from(errorRecords).limit(1);
    await this.db.select({ id: healthSamples.id }).from(healthSamples).limit(1);
    return true;
  }
  async record(input: ErrorInput) {
    const error = errorInputSchema.parse(input);
    const now = new Date(), windowAt = new Date(Math.floor(now.getTime() / 300000) * 300000);
    return this.db.transaction(async (tx) => {
      // 未授權 Guild 不寫入租戶資料；此處保留安全拒絕類別作全域診斷，隱去 Guild ID。
      const [guild] = error.guildId ? await tx.select().from(guilds).where(eq(guilds.id, error.guildId)).for('share') : [];
      const guildId = guild?.authorized ? guild.id : null, scope = guildId ?? 'global', moduleId = error.moduleId ?? 'Core';
      const values = { guildId, scope, moduleId, type: error.type, code: error.code, summary: `${error.type} · ${error.code}`, windowAt, occurredAt: error.occurredAt, receivedAt: now, lastOccurredAt: error.occurredAt };
      const [created] = await tx.insert(errorRecords).values(values).onConflictDoNothing().returning();
      if (!created) {
        const [updated] = await tx.update(errorRecords).set({ count: sql`${errorRecords.count} + 1`, lastOccurredAt: sql`greatest(${errorRecords.lastOccurredAt}, ${error.occurredAt})`, status: 'Open', acknowledgedBy: null, acknowledgedAt: null }).where(and(eq(errorRecords.scope, scope), eq(errorRecords.moduleId, moduleId), eq(errorRecords.type, error.type), eq(errorRecords.code, error.code), eq(errorRecords.windowAt, windowAt))).returning();
        return updated;
      }
      if (guild?.authorized) {
        const policy = guildConfigurationSchema.parse(guild.configuration);
        const [module] = await tx.select().from(moduleStates).where(and(eq(moduleStates.guildId, guild.id), eq(moduleStates.moduleId, 'PT-08')));
        if (module?.enabled && policy.channels.error) await enqueueNotification(tx, { guildId: guild.id, moduleId: 'PT-08', channelId: policy.channels.error, eventKey: `error:${created.id}`,
          payload: { eventType: 'error.record', entityId: guild.id, sourceChannelId: null, eventAt: now.toISOString(), timestampSource: 'received', metadata: { entityName: created.summary, after: `Error ID：${created.id}；Module：${moduleId}` } }, expiresAt: new Date(now.getTime() + policy.audit.retentionDays * 86400000) });
      }
      return created;
    });
  }
  async list(guildId: string | null) { return this.db.select().from(errorRecords).where(guildId === null ? sql`${errorRecords.guildId} is null` : eq(errorRecords.guildId, guildId)).orderBy(desc(errorRecords.lastOccurredAt)).limit(10); }
  async detail(guildId: string | null, id: string) { return (await this.db.select().from(errorRecords).where(and(eq(errorRecords.id, id), guildId === null ? sql`${errorRecords.guildId} is null` : eq(errorRecords.guildId, guildId))))[0]; }
  async stats(guildId: string | null) { return this.db.select({ status: errorRecords.status, count: sql<number>`coalesce(sum(${errorRecords.count}),0)::int`, groups: sql<number>`count(*)::int` }).from(errorRecords).where(guildId === null ? sql`${errorRecords.guildId} is null` : eq(errorRecords.guildId, guildId)).groupBy(errorRecords.status); }
  async acknowledge(guildId: string | null, id: string, actorId: string) {
    const [record] = await this.db.update(errorRecords).set({ status: 'Acknowledged', acknowledgedBy: actorId, acknowledgedAt: new Date() }).where(and(eq(errorRecords.id, id), eq(errorRecords.status, 'Open'), guildId === null ? sql`${errorRecords.guildId} is null` : eq(errorRecords.guildId, guildId))).returning();
    if (!record && !(await this.detail(guildId, id))) throw new PulseError('INVALID_INPUT');
  }
  async sample(guildId: string, input: HealthMetrics) {
    const metrics = healthMetricsSchema.parse(input);
    await this.db.transaction(async (tx) => {
      const [guild] = await tx.select().from(guilds).where(eq(guilds.id, guildId)).for('share');
      const [module] = await tx.select().from(moduleStates).where(and(eq(moduleStates.guildId, guildId), eq(moduleStates.moduleId, 'PT-05'))).for('share');
      if (!guild?.authorized || !module?.enabled) return;
      await tx.insert(healthSamples).values({ guildId, metrics, expiresAt: new Date(Date.now() + 30 * 86400000) });
    });
  }
  async history(guildId: string) { return this.db.select().from(healthSamples).where(and(eq(healthSamples.guildId, guildId), sql`${healthSamples.expiresAt} > now()`)).orderBy(desc(healthSamples.sampledAt)).limit(10); }
  async prune() { await this.db.delete(healthSamples).where(lt(healthSamples.expiresAt, new Date())); }
}
