import { PermissionFlagsBits, type Client, type GuildMember } from 'discord.js';
import type { Actor } from '../../../packages/shared/src/models.js';
import type { ModerationRequest } from '../../../packages/shared/src/moderation.js';
import type { ModerationTransport } from '../../../packages/core/src/moderation-service.js';
import { PulseError } from '../../../packages/shared/src/errors.js';
const permission = (action: ModerationRequest['action']) => action === 'kick' ? PermissionFlagsBits.KickMembers : action === 'ban' || action === 'unban' ? PermissionFlagsBits.BanMembers : action === 'purge' ? PermissionFlagsBits.ManageMessages : PermissionFlagsBits.ModerateMembers;
export function validateTarget(actor: { id: string; isGuildOwner: boolean; higherThanTarget: boolean }, bot: { id: string; higherThanTarget: boolean }, target: { id: string; isGuildOwner: boolean; isBot: boolean; administrator: boolean }, timeout: boolean) {
  if (target.id === actor.id || target.id === bot.id || target.isGuildOwner || target.isBot) throw new PulseError('INVALID_INPUT');
  if ((!actor.isGuildOwner && !actor.higherThanTarget) || !bot.higherThanTarget || (timeout && target.administrator)) throw new PulseError('PERMISSION_DENIED');
}
export class DiscordModerationTransport implements ModerationTransport {
  constructor(private readonly client: Client) {}
  async authorize(actor: Actor) {
    const guild = this.client.guilds.cache.get(actor.guildId);
    if (!guild) throw new PulseError('GUILD_DENIED');
    const member = await guild.members.fetch({ user: actor.userId, force: true });
    if (![PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers].some((p) => member.permissions.has(p))) throw new PulseError('PERMISSION_DENIED');
  }
  private async context(actor: Actor, request: ModerationRequest) {
    const guild = this.client.guilds.cache.get(actor.guildId);
    if (!guild) throw new PulseError('GUILD_DENIED');
    const moderator = await guild.members.fetch({ user: actor.userId, force: true });
    const bot = await guild.members.fetchMe({ force: true });
    const required = permission(request.action);
    if (!moderator.permissions.has(required) || !bot.permissions.has(required)) throw new PulseError('PERMISSION_DENIED');
    return { guild, moderator, bot };
  }
  async validate(actor: Actor, request: ModerationRequest) {
    const { guild, moderator, bot } = await this.context(actor, request);
    if (request.action === 'purge') {
      const channel = await guild.channels.fetch(request.channelId!);
      if (!channel || !channel.isTextBased() || !('bulkDelete' in channel) || !channel.permissionsFor(moderator)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]) || !channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages])) throw new PulseError('PERMISSION_DENIED');
      return;
    }
    if (request.action === 'unban') {
      if (request.targetId === actor.userId || request.targetId === bot.id || request.targetId === guild.ownerId) throw new PulseError('INVALID_INPUT');
      await guild.bans.fetch(request.targetId);
      return;
    }
    const target = await guild.members.fetch({ user: request.targetId, force: true });
    validateTarget({ id: moderator.id, isGuildOwner: moderator.id === guild.ownerId, higherThanTarget: moderator.roles.highest.comparePositionTo(target.roles.highest) > 0 },
      { id: bot.id, higherThanTarget: bot.roles.highest.comparePositionTo(target.roles.highest) > 0 },
      { id: target.id, isGuildOwner: target.id === guild.ownerId, isBot: target.user.bot, administrator: target.permissions.has(PermissionFlagsBits.Administrator) }, request.action === 'timeout' || request.action === 'untimeout');
    if (request.action === 'untimeout' && !target.communicationDisabledUntilTimestamp) throw new PulseError('INVALID_INPUT');
  }
  async execute(actor: Actor, request: ModerationRequest, caseId: string) {
    // 前一個 DB await 期間 Discord 狀態可能改變；外部寫入前重新取得權限與目標。
    await this.validate(actor, request);
    const guild = this.client.guilds.cache.get(actor.guildId)!;
    const reason = `PulseTools Case ${caseId}; Moderator ${actor.userId}`;
    if (request.action === 'warn') return null; // 警告存為案件，不擅自私訊成員。
    if (request.action === 'purge') {
      const channel = await guild.channels.fetch(request.channelId!);
      if (!channel?.isTextBased() || !('bulkDelete' in channel)) throw new PulseError('INVALID_INPUT');
      const messages = await channel.messages.fetch({ limit: request.count! });
      // 保守留一秒邊界；SDK 再次過濾兩週前訊息，不退回逐筆刪除舊訊息。
      const eligible = messages.filter((m) => m.createdTimestamp > Date.now() - 14 * 86400000 + 1000 && !m.pinned);
      if (!eligible.size) return 0;
      return (await channel.bulkDelete(eligible, true)).size;
    }
    if (request.action === 'unban') { await guild.members.unban(request.targetId, reason); return null; }
    const target: GuildMember = await guild.members.fetch({ user: request.targetId, force: true });
    if (request.action === 'timeout') await target.timeout(request.durationMinutes! * 60000, reason);
    else if (request.action === 'untimeout') await target.timeout(null, reason);
    else if (request.action === 'kick') await target.kick(reason);
    else if (request.action === 'ban') await target.ban({ deleteMessageSeconds: 0, reason });
    return null;
  }
}
