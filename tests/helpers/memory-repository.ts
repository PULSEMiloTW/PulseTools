// 僅供離線測試使用，正式 Bot 永遠使用 PostgresRepository。
import { randomUUID } from 'node:crypto';
import type { FoundationRepository } from '../../packages/database/src/repository.js';
import { guildConfigurationSchema, type GuildConfiguration, type GuildRecord, type InternalRole, type ModuleState, type SecurityEvent } from '../../packages/shared/src/models.js';
import { PulseError } from '../../packages/shared/src/errors.js';
import { receivedTimestamp } from '../../packages/shared/src/timestamp.js';

export class MemoryRepository implements FoundationRepository {
  readonly guildData = new Map<string, GuildRecord>();
  readonly operatorData = new Map<string, InternalRole>();
  readonly states = new Map<string, ModuleState>();
  readonly events: SecurityEvent[] = [];
  private locked = false;
  async health() { return true; }
  async auditHealth() { return true; }
  async guild(id: string) { const guild = this.guildData.get(id); return guild ? structuredClone(guild) : undefined; }
  async authorizedGuilds() { return [...this.guildData.values()].filter((guild) => guild.authorized).map((guild) => structuredClone(guild)); }
  async setGuildAuthorization(id: string, name: string, authorized: boolean, actorId: string) {
    const existing = this.guildData.get(id);
    this.guildData.set(id, { id, name, authorized, configuration: existing?.configuration ?? guildConfigurationSchema.parse({}), revision: existing?.revision ?? 0, createdAt: existing?.createdAt ?? new Date(), updatedAt: new Date() });
    await this.recordEvent({ guildId: null, actorId, action: authorized ? 'guild.allow' : 'guild.deny', details: { targetGuildId: id }, ...receivedTimestamp() });
  }
  async operator(guildId: string, userId: string) { return this.operatorData.get(`${guildId}:${userId}`); }
  async setOperator(guildId: string, userId: string, role: InternalRole | null, actorId: string) {
    if (role) this.operatorData.set(`${guildId}:${userId}`, role); else this.operatorData.delete(`${guildId}:${userId}`);
    await this.recordEvent({ guildId, actorId, action: 'operator.change', details: { userId, role }, ...receivedTimestamp() });
  }
  async saveConfiguration(guildId: string, configuration: GuildConfiguration, revision: number, actorId: string) {
    const existing = this.guildData.get(guildId);
    if (!existing?.authorized || existing.revision !== revision) throw new PulseError('CONFLICT');
    const saved = { ...existing, configuration: structuredClone(configuration), revision: revision + 1, updatedAt: new Date() };
    this.guildData.set(guildId, saved);
    await this.recordEvent({ guildId, actorId, action: 'configuration.change', details: { revision: saved.revision }, ...receivedTimestamp() });
    return structuredClone(saved);
  }
  async moduleStates(guildId: string) { return [...this.states.values()].filter((state) => state.guildId === guildId).map((state) => structuredClone(state)); }
  async saveModuleState(state: ModuleState, actorId: string) {
    if (!this.guildData.get(state.guildId)?.authorized) throw new PulseError('GUILD_DENIED');
    this.states.set(`${state.guildId}:${state.moduleId}`, structuredClone(state));
    await this.recordEvent({ guildId: state.guildId, actorId, action: 'module.change', details: { moduleId: state.moduleId }, ...receivedTimestamp() });
  }
  async lockdown() { return this.locked; }
  async setLockdown(enabled: boolean, actorId: string) {
    this.locked = enabled;
    await this.recordEvent({ guildId: null, actorId, action: 'owner.lockdown', details: { enabled }, ...receivedTimestamp() });
  }
  async recordEvent(event: Omit<SecurityEvent, 'id'>) { this.events.push({ id: randomUUID(), ...structuredClone(event) }); }
}
