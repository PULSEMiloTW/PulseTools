import { z } from 'zod';

export const snowflake = z.string().regex(/^[1-9]\d{16,19}$/, 'Discord ID 格式不正確');
export const moduleIds = ['PT-01', 'PT-02', 'PT-03', 'PT-04', 'PT-05', 'PT-06', 'PT-07', 'PT-08', 'PT-09', 'PT-10'] as const;
export const moduleIdSchema = z.enum(moduleIds);
export type ModuleId = z.infer<typeof moduleIdSchema>;
export const internalRoleSchema = z.enum(['admin', 'moderator']);
export type InternalRole = z.infer<typeof internalRoleSchema>;
export const guildConfigurationSchema = z.object({
  language: z.literal('zh-TW').default('zh-TW'),
  timezone: z.string().refine((value) => {
    try { new Intl.DateTimeFormat('zh-TW', { timeZone: value }); return true; } catch { return false; }
  }, '時區不正確').default('Asia/Taipei'),
  channels: z.partialRecord(z.enum(['system', 'member', 'message', 'voice', 'moderation', 'error']), snowflake).default({}),
  capture: z.object({
    enabled: z.boolean().default(false),
    allowedChannels: z.array(snowflake).max(100).default([]),
    excludedChannels: z.array(snowflake).max(100).default([]),
    retentionDays: z.number().int().min(1).max(365).default(30),
  }).strict().default({ enabled: false, allowedChannels: [], excludedChannels: [], retentionDays: 30 }),
}).strict();
export type GuildConfiguration = z.infer<typeof guildConfigurationSchema>;
export type ChannelPurpose = keyof GuildConfiguration['channels'];
export type ModuleHealth = 'Running' | 'Disabled' | 'Degraded' | 'Error' | 'Unavailable';
export interface Actor { userId: string; guildId: string; nativeAdministrator: boolean }
export interface GuildRecord {
  id: string;
  name: string;
  authorized: boolean;
  configuration: GuildConfiguration;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface ModuleState { guildId: string; moduleId: ModuleId; enabled: boolean; health: ModuleHealth; updatedAt: Date }
export interface SecurityEvent {
  id: string;
  guildId: string | null;
  actorId: string;
  action: string;
  details: Record<string, unknown>;
  eventAt: Date;
  receivedAt: Date;
  processedAt: Date;
  timestampSource: 'received';
}
