import { ChannelType, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import type { BotRuntime } from './interaction-handler.js';
import type { Actor } from '../../../packages/shared/src/models.js';
import { PulseError } from '../../../packages/shared/src/errors.js';
import { notificationEmbed } from '../../../packages/core/src/notification-worker.js';
import type { EventMetadata } from '../../../packages/shared/src/server-events.js';

export async function notificationTextChannel(interaction: ChatInputCommandInteraction) {
  const selected = interaction.options.getChannel('channel', true);
  const channel = await interaction.guild?.channels.fetch(selected.id);
  const me = interaction.guild?.members.me;
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) || !me || !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) throw new PulseError('INVALID_INPUT');
  return channel;
}
export function notificationTestMetadata(interaction: ChatInputCommandInteraction): EventMetadata {
  return { userId: interaction.user.id, userName: interaction.user.username, avatar: interaction.user.displayAvatarURL(), accountCreatedAt: interaction.user.createdAt.toISOString(), guildName: interaction.guild?.name ?? 'Unavailable', memberCount: interaction.guild?.memberCount ?? null };
}
export async function welcomeCommand(interaction: ChatInputCommandInteraction, actor: Actor, runtime: BotRuntime) {
  const { core } = runtime;
  if (!(await core.modules.enabled(actor.guildId, 'PT-02'))) throw new PulseError('MODULE_UNAVAILABLE');
  const sub = interaction.options.getSubcommand();
  const group = interaction.options.getSubcommandGroup(false);
  let guild = await core.configuration.view(actor);
  const direction = interaction.options.getString('direction');
  if (direction !== null && direction !== 'join' && direction !== 'leave') throw new PulseError('INVALID_INPUT');
  if ((group === 'channel' || group === 'message' || ['preview', 'test', 'toggle'].includes(sub)) && !direction) throw new PulseError('INVALID_INPUT');
  if (sub === 'preview') {
    const payload = { eventType: direction === 'join' ? 'member.join' as const : 'member.leave' as const, entityId: actor.userId, sourceChannelId: null, eventAt: new Date().toISOString(), timestampSource: 'received' as const, metadata: notificationTestMetadata(interaction), isTest: true };
    return { description: '', preview: notificationEmbed({ id: 'Ephemeral Preview', moduleId: 'PT-02', payload }, guild.configuration) };
  }
  if (sub !== 'status') {
    await core.permissions.requireAdmin(actor, true);
    const welcome = { ...guild.configuration.welcome };
    if (group === 'channel') welcome[direction === 'join' ? 'joinChannel' : 'leaveChannel'] = (await notificationTextChannel(interaction)).id;
    else if (group === 'message') welcome[direction === 'join' ? 'joinMessage' : 'leaveMessage'] = interaction.options.getString('value', true);
    else if (sub === 'toggle') welcome[direction === 'join' ? 'joinEnabled' : 'leaveEnabled'] = interaction.options.getBoolean('enabled', true);
    else if (sub === 'account') welcome.showAccountCreated = interaction.options.getBoolean('enabled', true);
    else if (sub === 'test') {
      if (!runtime.notifications) throw new PulseError('MODULE_UNAVAILABLE');
      const channelId = await runtime.notifications.test(actor.guildId, 'PT-02', direction === 'join' ? 'member.join' : 'member.leave', notificationTestMetadata(interaction));
      runtime.wakeNotifications?.();
      return { description: `測試通知已排入頻道 ${channelId} 的發送佇列；/logs status 可檢查發送結果。` };
    } else throw new PulseError('INVALID_INPUT');
    guild = await core.configuration.setWelcome(actor, welcome, guild.revision);
  }
  const welcome = guild.configuration.welcome;
  return { description: `成員事件接收：${runtime.memberEventsEnabled ? '啟用' : '未啟用'}\n加入通知：${welcome.joinEnabled ? '啟用' : '停用'} · 頻道 ${welcome.joinChannel ?? '未設定'}\n離開通知：${welcome.leaveEnabled ? '啟用' : '停用'} · 頻道 ${welcome.leaveChannel ?? '未設定'}\n加入文字：${welcome.joinMessage}\n離開文字：${welcome.leaveMessage}\n帳號建立日期：${welcome.showAccountCreated ? '顯示' : '隱藏'}\n離開原因不推定為退出、踢除或封鎖。` };
}
