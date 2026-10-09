import { z } from 'zod';
import { messageEventTypeSchema, snowflake } from './models.js';

export const captureStatuses = ['Captured', 'Partial', 'Unavailable'] as const;
export type CaptureStatus = typeof captureStatuses[number];
export const messageEventSchema = z.object({
  guildId: snowflake, channelId: snowflake, messageId: snowflake,
  authorId: snowflake.nullable(), type: messageEventTypeSchema,
  eventKey: z.string().min(1).max(200),
  content: z.string().max(4000).nullable(),
  partial: z.boolean(), receivedAt: z.date(), eventAt: z.date().nullable(),
  messageCreatedAt: z.date().nullable().optional(),
}).strict();
export type MessageEvent = z.infer<typeof messageEventSchema>;
export interface SnapshotRecord {
  guildId: string; channelId: string; messageId: string; authorId: string | null;
  originalContent: string | null; latestContent: string | null; captureStatus: CaptureStatus;
  revision: number; createdAt: Date; updatedAt: Date; deletedAt: Date | null; expiresAt: Date;
}
export interface MessageVersionRecord {
  guildId: string; messageId: string; revision: number; content: string | null;
  captureStatus: CaptureStatus; eventType: string; eventAt: Date; receivedAt: Date;
}
