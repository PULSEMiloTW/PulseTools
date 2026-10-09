import { z } from 'zod';
import type { PostgresMonitoringRepository } from '../../database/src/monitoring-repository.js';
import type { Actor } from '../../shared/src/models.js';
import { PulseError } from '../../shared/src/errors.js';
import type { Core } from './index.js';
export class ErrorService {
  constructor(private readonly core: Core, private readonly store: Pick<PostgresMonitoringRepository,'list'|'detail'|'stats'|'acknowledge'>) {}
  private async authorize(actor: Actor, global: boolean) {
    await this.core.permissions.requireAdmin(actor);
    if (global) this.core.permissions.requireOwner(actor.userId);
    else if (!(await this.core.modules.enabled(actor.guildId, 'PT-08'))) throw new PulseError('MODULE_UNAVAILABLE');
  }
  async list(actor: Actor, global = false) { await this.authorize(actor, global); return this.store.list(global ? null : actor.guildId); }
  async stats(actor: Actor, global = false) { await this.authorize(actor, global); return this.store.stats(global ? null : actor.guildId); }
  async detail(actor: Actor, id: string, global = false) {
    await this.authorize(actor, global);
    if (!z.uuid().safeParse(id).success) throw new PulseError('INVALID_INPUT');
    const result = await this.store.detail(global ? null : actor.guildId, id);
    if (!result) throw new PulseError('INVALID_INPUT');
    return result;
  }
  async acknowledge(actor: Actor, id: string, global = false) {
    await this.detail(actor, id, global);
    // 確認錯誤為低風險復原操作，Lockdown 下保留，不會解除安全模式。
    await this.store.acknowledge(global ? null : actor.guildId, id, actor.userId);
  }
}
