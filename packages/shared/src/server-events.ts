import { z } from 'zod';
import { auditEventTypeSchema, serverEventTypes, snowflake, type GuildConfiguration } from './models.js';

export const eventMetadataSchema = z.object({
  guildName: z.string().max(100).optional(), entityName: z.string().max(100).optional(),
  userName: z.string().max(100).optional(), userId: snowflake.optional(),
  avatar: z.url().refine((value) => ['cdn.discordapp.com', 'media.discordapp.net'].includes(new URL(value).hostname)).optional(),
  memberCount: z.number().int().nonnegative().nullable().optional(),
  accountCreatedAt: z.iso.datetime().optional(),
  before: z.string().max(1500).optional(), after: z.string().max(1500).optional(),
}).strict();
export type EventMetadata = z.infer<typeof eventMetadataSchema>;
export const serverEventSchema = z.object({
  guildId: snowflake, entityId: snowflake, channelId: snowflake.nullable(),
  type: z.enum(serverEventTypes), eventKey: z.string().min(1).max(200),
  receivedAt: z.date(), eventAt: z.date().nullable(), metadata: eventMetadataSchema,
}).strict();
export type ServerEvent = z.infer<typeof serverEventSchema>;
export const notificationPayloadSchema = z.object({
  eventType: auditEventTypeSchema, entityId: snowflake, sourceChannelId: snowflake.nullable(),
  eventAt: z.iso.datetime(), timestampSource: z.enum(['discord', 'received']), metadata: eventMetadataSchema,
  isTest: z.boolean().optional(),
}).strict();
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export const categoryFor = (type: string) => type.startsWith('member.') ? 'member' : type.startsWith('message.') ? 'message' : type.startsWith('voice.') ? 'voice' : 'system';
export function notificationChannel(configuration: GuildConfiguration, moduleId: 'PT-01' | 'PT-02', type: string) {
  if (moduleId === 'PT-02') return type === 'member.join' && configuration.welcome.joinEnabled ? configuration.welcome.joinChannel : type === 'member.leave' && configuration.welcome.leaveEnabled ? configuration.welcome.leaveChannel : undefined;
  return configuration.channels[categoryFor(type)];
}
