import type { FoundationRepository } from '../../database/src/repository.js';
import { internalRoleSchema, snowflake, type InternalRole } from '../../shared/src/models.js';
import { PermissionManager } from './permission-manager.js';
import { PulseError } from '../../shared/src/errors.js';

function validId(value: string) { if (!snowflake.safeParse(value).success) throw new PulseError('INVALID_INPUT'); }
export class GuildManager {
  constructor(private readonly repository: FoundationRepository, private readonly permissions: PermissionManager) {}
  async list(userId: string) { this.permissions.requireOwner(userId); return this.repository.authorizedGuilds(); }
  async setAuthorization(userId: string, guildId: string, name: string, authorized: boolean) {
    this.permissions.requireOwner(userId); validId(guildId);
    await this.repository.setGuildAuthorization(guildId, name.slice(0, 100), authorized, userId);
  }
  async setOperator(ownerId: string, guildId: string, userId: string, role: InternalRole | null) {
    this.permissions.requireOwner(ownerId); validId(guildId); validId(userId);
    await this.permissions.requireGuild(guildId);
    if (role && !internalRoleSchema.safeParse(role).success) throw new PulseError('INVALID_INPUT');
    await this.repository.setOperator(guildId, userId, role, ownerId);
  }
}
