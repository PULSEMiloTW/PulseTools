import { boolean, check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { GuildConfiguration, InternalRole, ModuleHealth, ModuleId } from '../../shared/src/models.js';
import type { CaptureStatus } from '../../shared/src/audit.js';

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
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull().references(() => guilds.id),
  channelId: text('channel_id').notNull(), messageId: text('message_id').notNull(), authorId: text('author_id'),
  eventType: text('event_type').notNull(), eventKey: text('event_key').notNull(),
  eventAt: utc('event_at'), receivedAt: utc('received_at'), processedAt: utc('processed_at'),
  timestampSource: text('timestamp_source').$type<'discord' | 'received'>().notNull(),
  captureStatus: text('capture_status').$type<CaptureStatus>().notNull(),
  actorId: text('actor_id'), attribution: text('attribution').notNull().default('無法確認'),
  expiresAt: utc('expires_at'),
}, (table) => [uniqueIndex('audit_event_deduplication').on(table.guildId, table.eventKey), index('audit_guild_time').on(table.guildId, table.eventAt), index('audit_expiry').on(table.expiresAt)]).enableRLS();
export const messageSnapshots = pgTable('message_snapshots', {
  guildId: text('guild_id').notNull().references(() => guilds.id), messageId: text('message_id').notNull(),
  channelId: text('channel_id').notNull(), authorId: text('author_id'),
  originalContent: text('original_content'), latestContent: text('latest_content'),
  captureStatus: text('capture_status').$type<CaptureStatus>().notNull(), revision: integer('revision').notNull().default(0),
  createdAt: utc('created_at'), updatedAt: utc('updated_at'), deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }), expiresAt: utc('expires_at'),
}, (table) => [primaryKey({ columns: [table.guildId, table.messageId] }), index('snapshot_expiry').on(table.expiresAt)]).enableRLS();
export const messageVersions = pgTable('message_versions', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull(), messageId: text('message_id').notNull(),
  revision: integer('revision').notNull(), content: text('content'), captureStatus: text('capture_status').$type<CaptureStatus>().notNull(),
  eventType: text('event_type').notNull(), eventAt: utc('event_at'), receivedAt: utc('received_at'), expiresAt: utc('expires_at'),
}, (table) => [foreignKey({ columns: [table.guildId, table.messageId], foreignColumns: [messageSnapshots.guildId, messageSnapshots.messageId] }).onDelete('cascade'), uniqueIndex('message_revision').on(table.guildId, table.messageId, table.revision), index('version_expiry').on(table.expiresAt)]).enableRLS();
