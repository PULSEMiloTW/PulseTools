import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { guilds, moderationCases, moderationNotes, moduleStates, systemSettings } from './schema.js';
import { guildConfigurationSchema, type Actor } from '../../shared/src/models.js';
import { moderationRequestSchema, type ModerationRequest, type CaseStatus } from '../../shared/src/moderation.js';
import { PulseError } from '../../shared/src/errors.js';
import { enqueueNotification } from './notification-repository.js';
export type ModerationCase = typeof moderationCases.$inferSelect;
export interface ModerationStore {
  begin(actor: Actor, request: ModerationRequest): Promise<{ record: ModerationCase; created: boolean }>;
  finish(record: ModerationCase, status: Exclude<CaseStatus, 'Pending'>, code: string | null, affected: number | null): Promise<ModerationCase>;
  history(guildId: string, targetId: string): Promise<ModerationCase[]>;
  detail(guildId: string, id: string): Promise<ModerationCase | undefined>;
  notes(guildId: string, id: string): Promise<(typeof moderationNotes.$inferSelect)[]>;
  note(guildId: string, id: string, authorId: string, text: string): Promise<void>;
}
export class PostgresModerationRepository implements ModerationStore {
  constructor(private readonly db: Database) {}
  async health() { await this.db.select({ id: moderationCases.id }).from(moderationCases).limit(1); return true; }
  async begin(actor: Actor, input: ModerationRequest) {
    const request = moderationRequestSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const [guild] = await tx.select().from(guilds).where(eq(guilds.id, actor.guildId)).for('share');
      if (!guild?.authorized) throw new PulseError('GUILD_DENIED');
      const [lock] = await tx.select().from(systemSettings).where(eq(systemSettings.key, 'lockdown')).for('share');
      if (lock?.enabled) throw new PulseError('LOCKDOWN');
      const [module] = await tx.select().from(moduleStates).where(and(eq(moduleStates.guildId, actor.guildId), eq(moduleStates.moduleId, 'PT-04'))).for('share');
      if (!module?.enabled) throw new PulseError('MODULE_UNAVAILABLE');
      if (request.relatedCaseId) {
        const [related] = await tx.select().from(moderationCases).where(and(eq(moderationCases.guildId, actor.guildId), eq(moderationCases.id, request.relatedCaseId)));
        if (!related || related.targetId !== request.targetId || related.status !== 'Succeeded' || related.action !== (request.action === 'unban' ? 'ban' : request.action === 'untimeout' ? 'timeout' : '')) throw new PulseError('INVALID_INPUT');
      }
      const [record] = await tx.insert(moderationCases).values({ guildId: actor.guildId, moderatorId: actor.userId, requestId: request.requestId, targetId: request.targetId,
        action: request.action, reason: request.reason, relatedCaseId: request.relatedCaseId ?? null, channelId: request.channelId ?? null,
        durationMinutes: request.durationMinutes ?? null, requestedCount: request.count ?? null }).onConflictDoNothing().returning();
      if (record) return { record, created: true };
      const [existing] = await tx.select().from(moderationCases).where(and(eq(moderationCases.guildId, actor.guildId), eq(moderationCases.requestId, request.requestId)));
      if (!existing || existing.moderatorId !== actor.userId || existing.targetId !== request.targetId || existing.action !== request.action) throw new PulseError('CONFLICT');
      return { record: existing, created: false };
    });
  }
  async finish(record: ModerationCase, status: Exclude<CaseStatus, 'Pending'>, code: string | null, affected: number | null) {
    return this.db.transaction(async (tx) => {
      const [saved] = await tx.update(moderationCases).set({ status, errorCode: code, affectedCount: affected, updatedAt: new Date() })
        .where(and(eq(moderationCases.guildId, record.guildId), eq(moderationCases.id, record.id), eq(moderationCases.status, 'Pending'))).returning();
      if (!saved) throw new PulseError('CONFLICT');
      const [guild] = await tx.select().from(guilds).where(eq(guilds.id, record.guildId));
      if (guild?.authorized) {
        const policy = guildConfigurationSchema.parse(guild.configuration);
        if (policy.channels.moderation && policy.moderation.notifyActions.includes(record.action)) await enqueueNotification(tx, { guildId: record.guildId, moduleId: 'PT-04', eventKey: `case:${record.id}`, channelId: policy.channels.moderation,
          payload: { eventType: 'moderation.case', entityId: record.targetId, sourceChannelId: record.channelId, eventAt: saved.updatedAt.toISOString(), timestampSource: 'received', metadata: { moderationAction: record.action, moderatorId: record.moderatorId, entityName: `${record.action} · ${status}`, after: `Case ID：${record.id}${affected === null ? '' : `；實際筆數：${affected}`}` } },
          expiresAt: new Date(Date.now() + policy.audit.retentionDays * 86400000) });
      }
      return saved;
    });
  }
  async history(guildId: string, targetId: string) { return this.db.select().from(moderationCases).where(and(eq(moderationCases.guildId, guildId), eq(moderationCases.targetId, targetId))).orderBy(desc(moderationCases.createdAt)).limit(10); }
  async detail(guildId: string, id: string) { return (await this.db.select().from(moderationCases).where(and(eq(moderationCases.guildId, guildId), eq(moderationCases.id, id))))[0]; }
  async notes(guildId: string, id: string) { return this.db.select().from(moderationNotes).where(and(eq(moderationNotes.guildId, guildId), eq(moderationNotes.caseId, id))).orderBy(desc(moderationNotes.createdAt)).limit(10); }
  async note(guildId: string, id: string, authorId: string, text: string) {
    if (!(await this.detail(guildId, id))) throw new PulseError('INVALID_INPUT');
    await this.db.insert(moderationNotes).values({ guildId, caseId: id, authorId, text });
  }
  async recover() { await this.db.update(moderationCases).set({ status: 'Unknown', errorCode: 'ACTION_UNKNOWN', updatedAt: new Date() }).where(eq(moderationCases.status, 'Pending')); }
  async count(guildId: string) { return (await this.db.select({ count: sql<number>`count(*)::int` }).from(moderationCases).where(eq(moderationCases.guildId, guildId)))[0]?.count ?? 0; }
}
