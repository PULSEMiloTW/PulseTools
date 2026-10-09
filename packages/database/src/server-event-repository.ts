import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { guildConfigurationSchema } from '../../shared/src/models.js';
import { notificationChannel, serverEventSchema, type ServerEvent, type NotificationPayload } from '../../shared/src/server-events.js';
import { guilds, moduleStates, serverEvents } from './schema.js';
import { enqueueNotification } from './notification-repository.js';

export class PostgresServerEventRepository {
  constructor(private readonly db: Database) {}
  async ingest(input: ServerEvent): Promise<'stored' | 'ignored' | 'duplicate'> {
    const event = serverEventSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const [guild] = await tx.select().from(guilds).where(eq(guilds.id, event.guildId)).for('share');
      if (!guild?.authorized) return 'ignored';
      const states = await tx.select().from(moduleStates).where(eq(moduleStates.guildId, event.guildId)).for('share');
      const policy = guildConfigurationSchema.parse(guild.configuration);
      const audit = states.some((state) => state.moduleId === 'PT-01' && state.enabled) && policy.audit.enabledEvents.includes(event.type);
      const welcome = states.some((state) => state.moduleId === 'PT-02' && state.enabled) && Boolean(notificationChannel(policy, 'PT-02', event.type));
      if (!audit && !welcome) return 'ignored';
      const expiresAt = new Date(event.receivedAt.getTime() + policy.audit.retentionDays * 86400000);
      const [saved] = await tx.insert(serverEvents).values({ guildId: event.guildId, entityId: event.entityId, channelId: event.channelId, eventType: event.type, eventKey: event.eventKey,
        metadata: event.metadata, eventAt: event.eventAt ?? event.receivedAt, receivedAt: event.receivedAt, timestampSource: event.eventAt ? 'discord' : 'received', expiresAt }).onConflictDoNothing().returning({ id: serverEvents.id });
      if (!saved) return 'duplicate';
      const payload: NotificationPayload = { eventType: event.type, entityId: event.entityId, sourceChannelId: event.channelId,
        eventAt: (event.eventAt ?? event.receivedAt).toISOString(), timestampSource: event.eventAt ? 'discord' : 'received', metadata: event.metadata };
      const welcomeChannel = welcome ? notificationChannel(policy, 'PT-02', event.type) : undefined;
      const auditChannel = audit ? notificationChannel(policy, 'PT-01', event.type) : undefined;
      if (auditChannel && auditChannel !== welcomeChannel) await enqueueNotification(tx, { guildId: guild.id, moduleId: 'PT-01', eventKey: event.eventKey, channelId: auditChannel, payload, expiresAt });
      if (welcomeChannel) await enqueueNotification(tx, { guildId: guild.id, moduleId: 'PT-02', eventKey: event.eventKey, channelId: welcomeChannel, payload, expiresAt });
      return 'stored';
    });
  }
  async recent(guildId: string) {
    const [guild] = await this.db.select().from(guilds).where(eq(guilds.id, guildId));
    if (!guild?.authorized) return [];
    const policy = guildConfigurationSchema.parse(guild.configuration);
    return this.db.select().from(serverEvents).where(and(eq(serverEvents.guildId, guildId), sql`${serverEvents.expiresAt} > now()`, sql`${serverEvents.receivedAt} > ${new Date(Date.now() - policy.audit.retentionDays * 86400000)}`)).orderBy(desc(serverEvents.receivedAt)).limit(10);
  }
}
