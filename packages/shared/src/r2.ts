import { z } from 'zod';
import { snowflake } from './models.js';
export const r2FileTypes = ['png','jpg','webp','gif','pdf','mp4','mp3','zip'] as const;
export const r2SettingsSchema = z.object({
  channels: z.array(snowflake).max(25).default([]), allowedTypes: z.array(z.enum(r2FileTypes)).min(1).max(8).default(['png','jpg','webp','gif','pdf']),
  maxBytes: z.number().int().min(1024).max(25*1024*1024).default(10*1024*1024), maxFiles: z.number().int().min(1).max(10).default(5),
  prefix: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/).default('uploads'), access: z.enum(['private','public']).default('private'),
  allowDelete: z.boolean().default(false), membersMayUpload: z.boolean().default(true), promptSeconds: z.number().int().min(60).max(900).default(300),
  resultChannelId: snowflake.nullable().default(null),
}).strict();
export type R2Settings = z.infer<typeof r2SettingsSchema>;
export const r2AttachmentSchema = z.object({ id: snowflake, name: z.string().min(1).max(255), size: z.number().int().positive().max(25*1024*1024), contentType: z.string().max(120).nullable() }).strict();
export type R2Attachment = z.infer<typeof r2AttachmentSchema>;
export const r2States = ['Pending','Uploading','Uploaded','Completed','Cancelled','Expired','Failed','PartiallyCompleted'] as const;
export type R2State = typeof r2States[number];
export type R2Choice = 'keep' | 'delete' | 'cancel';
export function safeFilename(name: string) { return name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(-100) || 'file'; }
export function attachmentUrl(value: string) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || !['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname) || !u.pathname.startsWith('/attachments/') || u.username || u.password || (u.port && u.port !== '443')) throw new Error('R2_ATTACHMENT_SOURCE');
  return u;
}
export function acceptedAttachment(file: R2Attachment, policy: R2Settings) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const canonical = ext === 'jpeg' ? 'jpg' : ext;
  return file.size <= policy.maxBytes && policy.allowedTypes.some(t=> t === canonical);
}

export function fileDisposition(contentType?:string) { return ['image/png','image/jpeg','image/webp','image/gif'].includes(contentType??'') ? 'inline' : 'attachment'; }
