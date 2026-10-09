import type { FoundationRepository } from '../../database/src/repository.js';
import type { Actor } from '../../shared/src/models.js';
import { PulseError } from '../../shared/src/errors.js';

export class PermissionManager {
  constructor(private readonly repository: FoundationRepository, private readonly ownerId: string) {}
  isOwner(userId: string) { return userId === this.ownerId; }
  requireOwner(userId: string) { if (!this.isOwner(userId)) throw new PulseError('OWNER_REQUIRED'); }
  async requireGuild(guildId: string) {
    if (!(await this.repository.guild(guildId))?.authorized) throw new PulseError('GUILD_DENIED');
  }
  async requireAdmin(actor: Actor, mutation = false) {
    await this.requireGuild(actor.guildId);
    if (mutation && await this.repository.lockdown()) throw new PulseError('LOCKDOWN');
    if (this.isOwner(actor.userId)) return;
    if (await this.repository.operator(actor.guildId, actor.userId) !== 'admin' || !actor.nativeAdministrator) {
      throw new PulseError('PERMISSION_DENIED');
    }
  }
}
