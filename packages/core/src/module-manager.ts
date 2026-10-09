import type { FoundationRepository } from '../../database/src/repository.js';
import type { Actor, ModuleId, ModuleState } from '../../shared/src/models.js';
import type { ModuleDefinition } from '../../modules/src/definition.js';
import { PulseError } from '../../shared/src/errors.js';
import { PermissionManager } from './permission-manager.js';

export class ModuleManager {
  private readonly runtime = new Map<string, ModuleState>();
  private readonly queues = new Map<string, Promise<unknown>>();
  constructor(private readonly repository: FoundationRepository, private readonly permissions: PermissionManager, private readonly definitions: readonly ModuleDefinition[]) {}
  definition(id: ModuleId) {
    const definition = this.definitions.find((module) => module.id === id);
    if (!definition) throw new PulseError('MODULE_UNAVAILABLE');
    return definition;
  }
  private key(guildId: string, id: ModuleId) { return `${guildId}:${id}`; }
  async list(actor: Actor) {
    await this.permissions.requireAdmin(actor);
    const states = await this.repository.moduleStates(actor.guildId);
    return this.definitions.map((definition) => {
      const saved = this.runtime.get(this.key(actor.guildId, definition.id)) ?? states.find((state) => state.moduleId === definition.id);
      return { id: definition.id, name: definition.name, description: definition.description, dependencies: definition.dependencies,
        enabled: saved?.enabled ?? false, health: !definition.available ? 'Unavailable' as const : saved?.health ?? 'Disabled' as const };
    });
  }
  async enabled(guildId: string, id: ModuleId) {
    if (!(await this.repository.guild(guildId))?.authorized || !this.definition(id).available) return false;
    return this.isRunning(guildId, id);
  }
  isRunning(guildId: string, id: ModuleId) { return this.runtime.get(this.key(guildId, id))?.health === 'Running'; }
  async setEnabled(actor: Actor, id: ModuleId, enabled: boolean) {
    const key = actor.guildId;
    const prior = this.queues.get(key) ?? Promise.resolve();
    const operation = prior.catch(() => undefined).then(() => this.change(actor, id, enabled));
    this.queues.set(key, operation);
    try { await operation; } finally { if (this.queues.get(key) === operation) this.queues.delete(key); }
  }
  private async change(actor: Actor, id: ModuleId, enabled: boolean) {
    await this.permissions.requireAdmin(actor, true);
    const definition = this.definition(id);
    if (enabled && !definition.available) throw new PulseError('MODULE_UNAVAILABLE');
    const states = await this.repository.moduleStates(actor.guildId);
    if (enabled && definition.dependencies.some((dep) => !states.some((state) => state.moduleId === dep && state.enabled && state.health === 'Running'))) throw new PulseError('DEPENDENCY_REQUIRED');
    if (!enabled && this.definitions.some((dep) => dep.dependencies.includes(id) && states.some((state) => state.moduleId === dep.id && state.enabled))) throw new PulseError('DEPENDENT_RUNNING');
    const current = this.runtime.get(this.key(actor.guildId, id));
    if (current?.enabled === enabled && current.health === (enabled ? 'Running' : 'Disabled')) return;
    const state: ModuleState = { guildId: actor.guildId, moduleId: id, enabled, health: enabled ? 'Running' : definition.available ? 'Disabled' : 'Unavailable', updatedAt: new Date() };
    try {
      if (enabled) await definition.initialize({ guildId: actor.guildId, repository: this.repository });
      else await definition.shutdown({ guildId: actor.guildId, repository: this.repository });
      await this.repository.saveModuleState(state, actor.userId);
      this.runtime.set(this.key(actor.guildId, id), state);
    } catch {
      try { await definition.shutdown({ guildId: actor.guildId, repository: this.repository }); } catch { /* 初始化或持久化失敗時盡力清理。 */ }
      const failed = { ...state, enabled: false, health: 'Error' as const };
      this.runtime.set(this.key(actor.guildId, id), failed);
      await this.repository.saveModuleState(failed, actor.userId);
      throw new PulseError('MODULE_UNAVAILABLE');
    }
  }
  async restore() {
    for (const guild of await this.repository.authorizedGuilds()) {
      for (const state of await this.repository.moduleStates(guild.id)) {
        const definition = this.definition(state.moduleId);
        if (!state.enabled || !definition.available) continue;
        try {
          await definition.initialize({ guildId: guild.id, repository: this.repository });
          this.runtime.set(this.key(guild.id, definition.id), { ...state, health: 'Running' });
        } catch {
          try { await definition.shutdown({ guildId: guild.id, repository: this.repository }); } catch { /* 單一模組清理失敗不影響其他模組。 */ }
          this.runtime.set(this.key(guild.id, definition.id), { ...state, health: 'Error' });
        }
      }
    }
  }
  async shutdown() {
    for (const state of this.runtime.values()) {
      if (state.health === 'Running') {
        try { await this.definition(state.moduleId).shutdown({ guildId: state.guildId, repository: this.repository }); }
        catch { /* 每個模組獨立關閉，不能阻止其他資源清理。 */ }
      }
    }
    this.runtime.clear();
  }
}
