import type { FoundationRepository } from '../../database/src/repository.js';
import { guildConfigurationSchema, type Actor, type ChannelPurpose } from '../../shared/src/models.js';
import { PulseError } from '../../shared/src/errors.js';
import { PermissionManager } from './permission-manager.js';

export class ConfigurationManager {
  constructor(private readonly repository: FoundationRepository, private readonly permissions: PermissionManager) {}
  async view(actor: Actor) {
    await this.permissions.requireAdmin(actor);
    const record = await this.repository.guild(actor.guildId);
    if (!record?.authorized) throw new PulseError('GUILD_DENIED');
    // 驗證資料庫內容，避免直接信任過去版本或手動輸入的 JSON。
    return { ...record, configuration: guildConfigurationSchema.parse(record.configuration) };
  }
  async replace(actor: Actor, input: unknown, expectedRevision: number) {
    await this.permissions.requireAdmin(actor, true);
    const parsed = guildConfigurationSchema.safeParse(input);
    if (!parsed.success || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new PulseError('INVALID_INPUT');
    return this.repository.saveConfiguration(actor.guildId, parsed.data, expectedRevision, actor.userId);
  }
  async setTimezone(actor: Actor, timezone: string) {
    const guild = await this.view(actor);
    return this.replace(actor, { ...guild.configuration, timezone }, guild.revision);
  }
  async setChannel(actor: Actor, purpose: ChannelPurpose, channelId: string) {
    const guild = await this.view(actor);
    return this.replace(actor, { ...guild.configuration, channels: { ...guild.configuration.channels, [purpose]: channelId } }, guild.revision);
  }
}
