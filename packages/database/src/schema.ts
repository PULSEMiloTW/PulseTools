import { boolean, check, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { GuildConfiguration, InternalRole, ModuleHealth, ModuleId } from '../../shared/src/models.js';

const utc = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' }).notNull().defaultNow();
export const guilds = pgTable('guilds', {
  id: text('id').primaryKey(), name: text('name').notNull(), authorized: boolean('authorized').notNull().default(false),
  configuration: jsonb('configuration').$type<GuildConfiguration>().notNull(), revision: integer('revision').notNull().default(0),
  createdAt: utc('created_at'), updatedAt: utc('updated_at'),
});
export const operators = pgTable('guild_administrators', {
  guildId: text('guild_id').notNull().references(() => guilds.id), userId: text('user_id').notNull(),
  role: text('role').$type<InternalRole>().notNull(), createdAt: utc('created_at'),
}, (table) => [primaryKey({ columns: [table.guildId, table.userId] }), check('operator_role', sql`${table.role} in ('admin', 'moderator')`)]);
export const moduleStates = pgTable('module_states', {
  guildId: text('guild_id').notNull().references(() => guilds.id), moduleId: text('module_id').$type<ModuleId>().notNull(),
  enabled: boolean('enabled').notNull().default(false), health: text('health').$type<ModuleHealth>().notNull().default('Disabled'), updatedAt: utc('updated_at'),
}, (table) => [primaryKey({ columns: [table.guildId, table.moduleId] }), check('module_health', sql`${table.health} in ('Running', 'Disabled', 'Degraded', 'Error', 'Unavailable')`)]);
export const configurationHistory = pgTable('configuration_history', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull().references(() => guilds.id),
  actorId: text('actor_id').notNull(), revision: integer('revision').notNull(), configuration: jsonb('configuration').$type<GuildConfiguration>().notNull(), createdAt: utc('created_at'),
});
export const securityEvents = pgTable('security_events', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id'), actorId: text('actor_id').notNull(), action: text('action').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull(), eventAt: utc('event_at'), receivedAt: utc('received_at'), processedAt: utc('processed_at'),
  timestampSource: text('timestamp_source').$type<'received'>().notNull().default('received'),
});
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(), enabled: boolean('enabled').notNull(), updatedAt: utc('updated_at'),
});
