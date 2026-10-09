import { and, eq, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { configurationHistory, guilds, moduleStates, operators, securityEvents, systemSettings } from './schema.js';
import type { GuildConfiguration, GuildRecord, InternalRole, ModuleState, SecurityEvent } from '../../shared/src/models.js';
import { PulseError } from '../../shared/src/errors.js';
import { receivedTimestamp } from '../../shared/src/timestamp.js';

export interface FoundationRepository {
  health(): Promise<boolean>;
  guild(id: string): Promise<GuildRecord | undefined>;
  authorizedGuilds(): Promise<GuildRecord[]>;
  setGuildAuthorization(id: string, name: string, authorized: boolean, actorId: string): Promise<void>;
  operator(guildId: string, userId: string): Promise<InternalRole | undefined>;
  setOperator(guildId: string, userId: string, role: InternalRole | null, actorId: string): Promise<void>;
  saveConfiguration(guildId: string, configuration: GuildConfiguration, revision: number, actorId: string): Promise<GuildRecord>;
  moduleStates(guildId: string): Promise<ModuleState[]>;
  saveModuleState(state: ModuleState, actorId: string): Promise<void>;
  lockdown(): Promise<boolean>;
  setLockdown(enabled: boolean, actorId: string): Promise<void>;
  recordEvent(event: Omit<SecurityEvent, 'id'>): Promise<void>;
}
function event(guildId: string | null, actorId: string, action: string, details: Record<string, unknown>) {
  return { guildId, actorId, action, details, ...receivedTimestamp() };
}
export class PostgresRepository implements FoundationRepository {
  constructor(private readonly db: Database) {}
  async health() { await this.db.execute(sql`select 1`); return true; }
  async guild(id: string) { return (await this.db.select().from(guilds).where(eq(guilds.id, id)))[0]; }
  async authorizedGuilds() { return this.db.select().from(guilds).where(eq(guilds.authorized, true)); }
  async setGuildAuthorization(id: string, name: string, authorized: boolean, actorId: string) {
    const { guildConfigurationSchema } = await import('../../shared/src/models.js');
    await this.db.transaction(async (tx) => {
      await tx.insert(guilds).values({ id, name, authorized, configuration: guildConfigurationSchema.parse({}) })
        .onConflictDoUpdate({ target: guilds.id, set: { name, authorized, updatedAt: new Date() } });
      await tx.insert(securityEvents).values(event(null, actorId, authorized ? 'guild.allow' : 'guild.deny', { targetGuildId: id }));
    });
  }
  async operator(guildId: string, userId: string) {
    return (await this.db.select().from(operators).where(and(eq(operators.guildId, guildId), eq(operators.userId, userId))))[0]?.role;
  }
  async setOperator(guildId: string, userId: string, role: InternalRole | null, actorId: string) {
    await this.db.transaction(async (tx) => {
      if (role) await tx.insert(operators).values({ guildId, userId, role }).onConflictDoUpdate({ target: [operators.guildId, operators.userId], set: { role } });
      else await tx.delete(operators).where(and(eq(operators.guildId, guildId), eq(operators.userId, userId)));
      await tx.insert(securityEvents).values(event(guildId, actorId, 'operator.change', { userId, role }));
    });
  }
  async saveConfiguration(guildId: string, configuration: GuildConfiguration, revision: number, actorId: string) {
    return this.db.transaction(async (tx) => {
      const [saved] = await tx.update(guilds).set({ configuration, revision: revision + 1, updatedAt: new Date() })
        .where(and(eq(guilds.id, guildId), eq(guilds.authorized, true), eq(guilds.revision, revision))).returning();
      if (!saved) throw new PulseError('CONFLICT');
      await tx.insert(configurationHistory).values({ guildId, actorId, revision: saved.revision, configuration });
      await tx.insert(securityEvents).values(event(guildId, actorId, 'configuration.change', { revision: saved.revision }));
      return saved;
    });
  }
  async moduleStates(guildId: string) { return this.db.select().from(moduleStates).where(eq(moduleStates.guildId, guildId)); }
  async saveModuleState(state: ModuleState, actorId: string) {
    await this.db.transaction(async (tx) => {
      const [guild] = await tx.select().from(guilds).where(eq(guilds.id, state.guildId)).for('update');
      if (!guild?.authorized) throw new PulseError('GUILD_DENIED');
      await tx.insert(moduleStates).values(state).onConflictDoUpdate({ target: [moduleStates.guildId, moduleStates.moduleId], set: { enabled: state.enabled, health: state.health, updatedAt: state.updatedAt } });
      await tx.insert(securityEvents).values(event(state.guildId, actorId, 'module.change', { moduleId: state.moduleId, enabled: state.enabled, health: state.health }));
    });
  }
  async lockdown() { return (await this.db.select().from(systemSettings).where(eq(systemSettings.key, 'lockdown')))[0]?.enabled ?? false; }
  async setLockdown(enabled: boolean, actorId: string) {
    await this.db.transaction(async (tx) => {
      await tx.insert(systemSettings).values({ key: 'lockdown', enabled }).onConflictDoUpdate({ target: systemSettings.key, set: { enabled, updatedAt: new Date() } });
      await tx.insert(securityEvents).values(event(null, actorId, 'owner.lockdown', { enabled }));
    });
  }
  async recordEvent(value: Omit<SecurityEvent, 'id'>) { await this.db.insert(securityEvents).values(value); }
}
