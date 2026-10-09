import { z } from 'zod';
import { snowflake, moderationActions } from './models.js';
export { moderationActions };
export const moderationRequestSchema = z.object({
  requestId: snowflake, targetId: snowflake, action: z.enum(moderationActions),
  reason: z.string().trim().min(1).max(400), confirmed: z.boolean(),
  durationMinutes: z.number().int().min(1).max(40320).optional(),
  count: z.number().int().min(1).max(100).optional(), channelId: snowflake.optional(),
  relatedCaseId: z.uuid().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === 'timeout' && value.durationMinutes === undefined) ctx.addIssue({ code: 'custom', message: '需要有效禁言分鐘數' });
  if (value.action === 'purge' && (!value.channelId || !value.count)) ctx.addIssue({ code: 'custom', message: '需要頻道及數量' });
  if (['untimeout', 'unban'].includes(value.action) && !value.relatedCaseId) ctx.addIssue({ code: 'custom', message: '需要原始案件 ID' });
  if (!value.confirmed) ctx.addIssue({ code: 'custom', message: '需要明確確認' });
});
export type ModerationRequest = z.infer<typeof moderationRequestSchema>;
export type ModerationAction = ModerationRequest['action'];
export type CaseStatus = 'Pending' | 'Succeeded' | 'Failed' | 'Unknown';
