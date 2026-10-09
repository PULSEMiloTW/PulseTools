import { z } from 'zod';
import { moduleIdSchema, snowflake } from './models.js';
import { safeErrorCode } from './errors.js';
export const errorTypes = ['Command', 'Permission', 'API', 'Database', 'Module', 'Gateway', 'Configuration', 'Dashboard', 'R2'] as const;
export const errorInputSchema = z.object({ guildId: snowflake.nullable(), moduleId: moduleIdSchema.nullable(), type: z.enum(errorTypes), code: z.enum(['OWNER_REQUIRED','GUILD_DENIED','PERMISSION_DENIED','LOCKDOWN','INVALID_INPUT','CONFLICT','MODULE_UNAVAILABLE','DEPENDENCY_REQUIRED','DEPENDENT_RUNNING','DATABASE_UNAVAILABLE','INTERNAL_ERROR','GATEWAY_ERROR','AUDIT_FAILED','NOTIFICATION_FAILED','HEALTH_FAILED']), occurredAt: z.date() }).strict();
export type ErrorInput = z.infer<typeof errorInputSchema>;
export const errorCategory = (error: unknown): ErrorInput['type'] => ['PERMISSION_DENIED','OWNER_REQUIRED','GUILD_DENIED','LOCKDOWN'].includes(safeErrorCode(error)) ? 'Permission' : 'Command';
export const healthMetricsSchema = z.object({
  startedAt: z.iso.datetime(), uptimeSeconds: z.number().nonnegative(), botStatus: z.enum(['Online','Degraded']),
  gatewayPingMs: z.number().nullable(), apiLatencyMs: z.number().nonnegative().nullable(), databaseHealthy: z.boolean(), databaseLatencyMs: z.number().nonnegative().nullable(),
  cpuPercent: z.number().nonnegative(), rssBytes: z.number().nonnegative(), heapBytes: z.number().nonnegative(),
  guildCount: z.number().int().nonnegative(), authorizedGuildCount: z.number().int().nonnegative().nullable(), activeModuleCount: z.number().int().nonnegative().nullable(),
  errorCount: z.number().int().nonnegative().nullable(), pendingNotifications: z.number().int().nonnegative().nullable(), failedNotifications: z.number().int().nonnegative().nullable(),
}).strict();
export type HealthMetrics = z.infer<typeof healthMetricsSchema>;
