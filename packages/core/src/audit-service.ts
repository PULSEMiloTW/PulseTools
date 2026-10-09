import type { PostgresAuditRepository } from '../../database/src/audit-repository.js';
import type { Core } from './index.js';
import { type Actor, snowflake } from '../../shared/src/models.js';
import { PulseError } from '../../shared/src/errors.js';
import { receivedTimestamp } from '../../shared/src/timestamp.js';
import type { PostgresServerEventRepository } from '../../database/src/server-event-repository.js';

export class AuditService {
  constructor(private readonly repository: PostgresAuditRepository, private readonly core: Core, private readonly server?: PostgresServerEventRepository) {}
  async recent(actor: Actor) {
    await this.core.permissions.requireAdmin(actor);
    const [messages, server] = await Promise.all([this.repository.recent(actor.guildId), this.server?.recent(actor.guildId) ?? Promise.resolve([])]);
    return [...messages.map((event) => ({ ...event, entityId: event.messageId })), ...server.map((event) => ({ ...event, captureStatus: '不適用' }))].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()).slice(0, 10);
  }
  async snapshot(actor: Actor, messageId: string) {
    await this.core.permissions.requireAdmin(actor);
    if (!snowflake.safeParse(messageId).success) throw new PulseError('INVALID_INPUT');
    const guild = await this.core.configuration.view(actor);
    if (!this.core.permissions.isOwner(actor.userId) && !guild.configuration.capture.viewerIds.includes(actor.userId)) throw new PulseError('PERMISSION_DENIED');
    if (!guild.configuration.capture.enabled) throw new PulseError('PERMISSION_DENIED');
    const result = await this.repository.snapshot(actor.guildId, messageId);
    if (result && (!guild.configuration.capture.allowedChannels.includes(result.snapshot.channelId) || guild.configuration.capture.excludedChannels.includes(result.snapshot.channelId))) throw new PulseError('PERMISSION_DENIED');
    await this.core.repository.recordEvent({ guildId: actor.guildId, actorId: actor.userId, action: 'audit.snapshot.access', details: { messageId }, ...receivedTimestamp() });
    return result;
  }
}
