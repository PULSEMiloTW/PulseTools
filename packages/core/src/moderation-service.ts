import { z } from 'zod';
import type { ModerationStore } from '../../database/src/moderation-repository.js';
import { moderationRequestSchema, type ModerationRequest } from '../../shared/src/moderation.js';
import type { Actor } from '../../shared/src/models.js';
import { snowflake, guildConfigurationSchema } from '../../shared/src/models.js';
import { PulseError } from '../../shared/src/errors.js';
import type { Core } from './index.js';
export interface ModerationTransport {
  authorize(actor: Actor): Promise<void>;
  validate(actor: Actor, request: ModerationRequest): Promise<void>;
  execute(actor: Actor, request: ModerationRequest, caseId: string): Promise<number | null>;
}
export class ModerationService {
  constructor(private readonly core: Core, private readonly store: ModerationStore, private readonly transport: ModerationTransport,
    private readonly onFailure?: (actor: Actor) => Promise<void>) {}
  async authorize(actor: Actor, mutation = false) {
    await this.core.permissions.requireModerator(actor, mutation);
    if (!(await this.core.modules.enabled(actor.guildId, 'PT-04'))) throw new PulseError('MODULE_UNAVAILABLE');
    await this.transport.authorize(actor);
  }
  async execute(actor: Actor, input: unknown) {
    await this.authorize(actor, true);
    const parsed = moderationRequestSchema.safeParse(input);
    if (!parsed.success) throw new PulseError('INVALID_INPUT');
    const request = parsed.data;
    await this.transport.validate(actor, request);
    await this.authorize(actor, true);
    const { record, created } = await this.store.begin(actor, request);
    if (!created) return record; // 相同 Interaction 不再次執行外部處分。
    let affected: number | null;
    try {
      await this.authorize(actor, true);
      await this.transport.validate(actor, request);
      affected = await this.transport.execute(actor, request, record.id);
    } catch (error) {
      const code = error instanceof PulseError ? error.code : error && typeof error === 'object' && 'code' in error && typeof error.code === 'number' && Number.isInteger(error.code) ? `DISCORD_${error.code}` : 'ACTION_UNKNOWN';
      const failed = await this.store.finish(record, code === 'ACTION_UNKNOWN' ? 'Unknown' : 'Failed', code, null);
      if (this.onFailure) await this.onFailure(actor);
      return failed;
    }
    // 外部操作成功後的 DB 失敗不能變成可重試；保留 Pending，啟動恢復為 Unknown。
    return this.store.finish(record, 'Succeeded', null, affected);
  }
  async history(actor: Actor, targetId: string) {
    await this.authorize(actor);
    if (!snowflake.safeParse(targetId).success) throw new PulseError('INVALID_INPUT');
    return this.store.history(actor.guildId, targetId);
  }
  async timezone(actor: Actor) {
    await this.authorize(actor);
    const guild = await this.core.repository.guild(actor.guildId);
    if (!guild?.authorized) throw new PulseError('GUILD_DENIED');
    return guildConfigurationSchema.parse(guild.configuration).timezone;
  }
  async detail(actor: Actor, id: string, targetId?: string) {
    await this.authorize(actor);
    if (!z.uuid().safeParse(id).success) throw new PulseError('INVALID_INPUT');
    const record = await this.store.detail(actor.guildId, id);
    if (!record || (targetId !== undefined && (!snowflake.safeParse(targetId).success || record.targetId !== targetId))) throw new PulseError('INVALID_INPUT');
    return { record, notes: await this.store.notes(actor.guildId, id) };
  }
  async note(actor: Actor, id: string, text: string, targetId?: string) {
    await this.authorize(actor, true);
    if (!z.uuid().safeParse(id).success || !text.trim() || text.length > 1000) throw new PulseError('INVALID_INPUT');
    if (targetId !== undefined) {
      const record = await this.store.detail(actor.guildId, id);
      if (!snowflake.safeParse(targetId).success || record?.targetId !== targetId) throw new PulseError('INVALID_INPUT');
    }
    await this.store.note(actor.guildId, id, actor.userId, text.trim());
  }
  async choices(actor: Actor, targetId: string, prefix: string, action?: 'timeout' | 'ban') {
    await this.authorize(actor);
    if (!snowflake.safeParse(targetId).success || !/^[a-f0-9-]{0,36}$/i.test(prefix)) return [];
    const timezone = guildConfigurationSchema.parse((await this.core.repository.guild(actor.guildId))?.configuration).timezone;
    return { records: await this.store.choices(actor.guildId, targetId, prefix.toLowerCase(), action), timezone };
  }
}
