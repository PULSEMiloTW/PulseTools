import { z } from 'zod';

export const snowflake = z.string().regex(/^[1-9]\d{16,19}$/, 'Discord ID 格式不正確');
export const moduleIds = ['PT-01', 'PT-02', 'PT-03', 'PT-04', 'PT-05', 'PT-06', 'PT-07', 'PT-08', 'PT-09', 'PT-10'] as const;
export const moduleIdSchema = z.enum(moduleIds);
export type ModuleId = z.infer<typeof moduleIdSchema>;
export const internalRoleSchema = z.enum(['admin', 'moderator']);
export type InternalRole = z.infer<typeof internalRoleSchema>;
export const messageEventTypes = ['message.create', 'message.update', 'message.delete'] as const;
export const messageEventTypeSchema = z.enum(messageEventTypes);
export type MessageEventType = z.infer<typeof messageEventTypeSchema>;
export const serverEventTypes = ['member.join', 'member.leave', 'member.update', 'member.nickname', 'member.role.add', 'member.role.remove', 'voice.join', 'voice.leave', 'voice.switch', 'role.create', 'role.update', 'role.delete', 'role.permissions', 'channel.create', 'channel.update', 'channel.delete', 'channel.permissions', 'guild.update', 'invite.create', 'invite.delete'] as const;
export const auditEventTypes = [...messageEventTypes, ...serverEventTypes] as const;
export const auditEventTypeSchema = z.enum(auditEventTypes);
export const logCategories = ['member', 'message', 'voice', 'moderation', 'system'] as const;
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
    viewerIds: z.array(snowflake).max(100).default([]),
    privacyNotice: z.string().max(1500).default(''),
  }).strict().default({ enabled: false, allowedChannels: [], excludedChannels: [], retentionDays: 30, viewerIds: [], privacyNotice: '' }),
  audit: z.object({
    enabledEvents: z.array(auditEventTypeSchema).max(30).default([...auditEventTypes]),
    retentionDays: z.number().int().min(1).max(365).default(30),
  }).strict().default({ enabledEvents: [...auditEventTypes], retentionDays: 30 }),
  welcome: z.object({
    joinEnabled: z.boolean().default(true), leaveEnabled: z.boolean().default(true),
    joinChannel: snowflake.optional(), leaveChannel: snowflake.optional(),
    joinMessage: z.string().min(1).max(1000).default('👋 歡迎加入【{guild}】！'),
    leaveMessage: z.string().min(1).max(1000).default('👋 成員已離開【{guild}】'),
    showAccountCreated: z.boolean().default(false),
  }).strict().default({ joinEnabled: true, leaveEnabled: true, joinMessage: '👋 歡迎加入【{guild}】！', leaveMessage: '👋 成員已離開【{guild}】', showAccountCreated: false }),
}).strict().superRefine((value, context) => {
  if (value.capture.enabled && (!value.capture.allowedChannels.length || !value.capture.privacyNotice.trim())) {
    context.addIssue({ code: 'custom', path: ['capture'], message: '啟用原文保存必須指定頻道與隱私告知。' });
  }
});
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
