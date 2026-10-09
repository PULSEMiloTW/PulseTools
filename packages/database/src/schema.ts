import { boolean, check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { GuildConfiguration, InternalRole, ModuleHealth, ModuleId } from '../../shared/src/models.js';
import type { CaptureStatus } from '../../shared/src/audit.js';
import type { EventMetadata, NotificationPayload } from '../../shared/src/server-events.js';
import type { ModerationAction, CaseStatus } from '../../shared/src/moderation.js';
import type { ErrorInput, HealthMetrics } from '../../shared/src/monitoring.js';

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
  uploadRequestId: uuid('upload_request_id'),
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
export const serverEvents = pgTable('server_events', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull().references(() => guilds.id),
  entityId: text('entity_id').notNull(), channelId: text('channel_id'), eventType: text('event_type').notNull(), eventKey: text('event_key').notNull(),
  metadata: jsonb('metadata').$type<EventMetadata>().notNull(), eventAt: utc('event_at'), receivedAt: utc('received_at'), processedAt: utc('processed_at'),
  timestampSource: text('timestamp_source').$type<'discord' | 'received'>().notNull(), attribution: text('attribution').notNull().default('無法確認'), expiresAt: utc('expires_at'),
}, (table) => [uniqueIndex('server_event_deduplication').on(table.guildId, table.eventKey), index('server_event_time').on(table.guildId, table.eventAt), index('server_event_expiry').on(table.expiresAt)]).enableRLS();
export const errorRecords = pgTable('error_records', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').references(() => guilds.id),
  scope: text('scope').notNull(), moduleId: text('module_id').notNull(), type: text('type').$type<ErrorInput['type']>().notNull(),
  code: text('code').notNull(), summary: text('summary').notNull(), windowAt: utc('window_at'),
  occurredAt: utc('occurred_at'), receivedAt: utc('received_at'), lastOccurredAt: utc('last_occurred_at'), count: integer('count').notNull().default(1),
  status: text('status').$type<'Open' | 'Acknowledged'>().notNull().default('Open'), acknowledgedBy: text('acknowledged_by'), acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true, mode: 'date' }),
}, (t) => [uniqueIndex('error_aggregation').on(t.scope, t.moduleId, t.type, t.code, t.windowAt), index('error_guild_time').on(t.guildId, t.lastOccurredAt), check('error_status', sql`${t.status} in ('Open','Acknowledged')`)]).enableRLS();
export const healthSamples = pgTable('health_samples', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull().references(() => guilds.id),
  metrics: jsonb('metrics').$type<HealthMetrics>().notNull(), sampledAt: utc('sampled_at'), expiresAt: utc('expires_at'),
}, (t) => [index('health_guild_time').on(t.guildId, t.sampledAt), index('health_expiry').on(t.expiresAt)]).enableRLS();
export const moderationCases = pgTable('moderation_cases', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull().references(() => guilds.id),
  requestId: text('request_id').notNull(), targetId: text('target_id').notNull(), moderatorId: text('moderator_id').notNull(),
  action: text('action').$type<ModerationAction>().notNull(), reason: text('reason').notNull(),
  status: text('status').$type<CaseStatus>().notNull().default('Pending'), relatedCaseId: uuid('related_case_id'),
  channelId: text('channel_id'), durationMinutes: integer('duration_minutes'), requestedCount: integer('requested_count'), affectedCount: integer('affected_count'),
  errorCode: text('error_code'), createdAt: utc('created_at'), updatedAt: utc('updated_at'),
}, (t) => [uniqueIndex('case_request').on(t.guildId, t.requestId), uniqueIndex('case_guild_id').on(t.guildId, t.id),
  foreignKey({ columns: [t.guildId, t.relatedCaseId], foreignColumns: [t.guildId, t.id] }),
  index('case_target_time').on(t.guildId, t.targetId, t.createdAt),
  check('case_status', sql`${t.status} in ('Pending','Succeeded','Failed','Unknown')`),
  check('case_action', sql`${t.action} in ('warn','timeout','untimeout','kick','ban','unban','purge')`),
]).enableRLS();
export const moderationNotes = pgTable('moderation_notes', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull(), caseId: uuid('case_id').notNull(),
  authorId: text('author_id').notNull(), text: text('text').notNull(), createdAt: utc('created_at'),
}, (t) => [foreignKey({ columns: [t.guildId, t.caseId], foreignColumns: [moderationCases.guildId, moderationCases.id] })]).enableRLS();
export const notificationOutbox = pgTable('notification_outbox', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull().references(() => guilds.id),
  moduleId: text('module_id').$type<'PT-01' | 'PT-02' | 'PT-04' | 'PT-08'>().notNull(), eventKey: text('event_key').notNull(), channelId: text('channel_id').notNull(),
  payload: jsonb('payload').$type<NotificationPayload>().notNull(),
  status: text('status').$type<'Pending' | 'Sending' | 'Sent' | 'Failed' | 'Cancelled'>().notNull().default('Pending'),
  attempts: integer('attempts').notNull().default(0), nextAttemptAt: utc('next_attempt_at'), leaseAt: timestamp('lease_at', { withTimezone: true, mode: 'date' }),
  sentMessageId: text('sent_message_id'), errorCode: text('error_code'), createdAt: utc('created_at'), updatedAt: utc('updated_at'), expiresAt: utc('expires_at'),
}, (table) => [uniqueIndex('notification_deduplication').on(table.guildId, table.moduleId, table.eventKey), index('notification_pending').on(table.status, table.nextAttemptAt), check('notification_status', sql`${table.status} in ('Pending','Sending','Sent','Failed','Cancelled')`)]).enableRLS();

export const r2GuildSettings = pgTable('r2_guild_settings', {
  guildId: text('guild_id').primaryKey().references(() => guilds.id), settings: jsonb('settings').$type<import('../../shared/src/r2.js').R2Settings>().notNull(), updatedAt: utc('updated_at'),
}).enableRLS();
export const r2UploadRequests = pgTable('r2_upload_requests', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull().references(() => guilds.id), channelId: text('channel_id').notNull(), messageId: text('message_id').notNull(), uploaderId: text('uploader_id').notNull(),
  attachments: jsonb('attachments').$type<import('../../shared/src/r2.js').R2Attachment[]>().notNull(), settings: jsonb('settings').$type<import('../../shared/src/r2.js').R2Settings>().notNull(),
  status: text('status').$type<import('../../shared/src/r2.js').R2State>().notNull().default('Pending'), choice: text('choice'), promptId: text('prompt_id'), resultId: text('result_id'), actorId: text('actor_id'), errorCode: text('error_code'),
  createdAt: utc('created_at'), expiresAt: utc('expires_at'), startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }), completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }), deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
}, t => [uniqueIndex('r2_request_message').on(t.guildId,t.messageId), uniqueIndex('r2_request_guild_id').on(t.guildId,t.id), index('r2_request_time').on(t.guildId,t.createdAt), check('r2_request_status',sql`${t.status} in ('Pending','Uploading','Uploaded','Completed','Cancelled','Expired','Failed','PartiallyCompleted')`)]).enableRLS();
export const r2UploadedObjects = pgTable('r2_uploaded_objects', {
  id: uuid('id').primaryKey(), guildId: text('guild_id').notNull(), requestId: uuid('request_id').notNull(), attachmentId: text('attachment_id').notNull(), filename: text('filename').notNull(), key: text('object_key').notNull(), contentType: text('content_type').notNull(), size: integer('size').notNull(), status: text('status').$type<'Uploading'|'Uploaded'|'Unknown'>().notNull(), createdAt: utc('created_at'), uploadedAt: timestamp('uploaded_at',{withTimezone:true,mode:'date'}),
}, t => [foreignKey({ columns:[t.guildId,t.requestId],foreignColumns:[r2UploadRequests.guildId,r2UploadRequests.id] }), uniqueIndex('r2_object_attachment').on(t.guildId,t.requestId,t.attachmentId), uniqueIndex('r2_object_key').on(t.key)]).enableRLS();
export const r2UploadEvents = pgTable('r2_upload_events', {
  id: uuid('id').defaultRandom().primaryKey(), guildId: text('guild_id').notNull(), requestId: uuid('request_id').notNull(), status: text('status').notNull(), code: text('code'), occurredAt: utc('occurred_at'),
}, t => [foreignKey({ columns:[t.guildId,t.requestId],foreignColumns:[r2UploadRequests.guildId,r2UploadRequests.id] }), index('r2_event_time').on(t.guildId,t.occurredAt)]).enableRLS();
