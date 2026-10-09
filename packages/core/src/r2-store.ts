import type { R2Attachment, R2Settings, R2State } from '../../shared/src/r2.js';
export interface R2Request {
  id: string; guildId: string; channelId: string; messageId: string; uploaderId: string; attachments: R2Attachment[]; settings: R2Settings;
  status: R2State; choice: string | null; promptId: string | null; resultId: string | null; actorId: string | null; errorCode: string | null;
  createdAt: Date; expiresAt: Date; startedAt: Date | null; completedAt: Date | null; deletedAt: Date | null;
}
export interface R2Object { id: string; guildId: string; requestId: string; attachmentId: string; filename: string; key: string; contentType: string; size: number; status: 'Uploading' | 'Uploaded' | 'Unknown'; createdAt: Date; uploadedAt?: Date | null; }
export interface R2Store {
  settings(guildId: string): Promise<R2Settings>;
  setSettings(guildId: string, settings: R2Settings): Promise<void>;
  create(input: Pick<R2Request,'guildId'|'channelId'|'messageId'|'uploaderId'|'attachments'|'settings'>): Promise<R2Request | undefined>;
  get(guildId: string, id: string): Promise<R2Request | undefined>;
  prompt(guildId: string, id: string, promptId: string | null): Promise<void>;
  claim(guildId: string, id: string, choice: string, actorId: string): Promise<R2Request | undefined>;
  state(guildId: string, id: string, status: R2State, errorCode?: string, resultId?: string, deletedAt?: Date): Promise<void>;
  object(object: Omit<R2Object,'createdAt'>): Promise<void>;
  objects(guildId: string, requestId: string): Promise<R2Object[]>;
  files(guildId: string): Promise<R2Request[]>;
  expire(): Promise<R2Request[]>;
  recover(): Promise<void>;
}
