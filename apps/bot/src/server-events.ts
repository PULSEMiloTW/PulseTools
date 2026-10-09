import { createHash, randomUUID } from 'node:crypto';
import { Events, type Client, type Guild } from 'discord.js';
import type { Core } from '../../../packages/core/src/index.js';
import type { EventRouter } from '../../../packages/core/src/event-router.js';
import type { ServerEvent, EventMetadata } from '../../../packages/shared/src/server-events.js';

const summary = (value: unknown) => { const text = JSON.stringify(value); return text.length > 1450 ? `${text.slice(0, 1450)}（截斷）` : text; };
export function memberDifferences(before: { nickname: string | null; roles: string[] }, after: { nickname: string | null; roles: string[] }) {
  const changes: { type: ServerEvent['type']; before: string; after: string }[] = [];
  if (before.nickname !== after.nickname) changes.push({ type: 'member.nickname', before: before.nickname ?? '未設定', after: after.nickname ?? '未設定' });
  const added = after.roles.filter((id) => !before.roles.includes(id));
  const removed = before.roles.filter((id) => !after.roles.includes(id));
  if (added.length) changes.push({ type: 'member.role.add', before: '—', after: summary(added) });
  if (removed.length) changes.push({ type: 'member.role.remove', before: summary(removed), after: '—' });
  return changes;
}
export function voiceTransition(before: string | null, after: string | null): ServerEvent['type'] | undefined {
  return before === after ? undefined : !before ? 'voice.join' : !after ? 'voice.leave' : 'voice.switch';
}
export function bindServerEvents(client: Client, core: Core, router: EventRouter<ServerEvent>) {
  const contexts = new Map<number, { prefix: string; receivedAt: Date }>();
  const sessions = new Map<number, string>();
  client.on(Events.Raw, (packet, shardId) => {
    if (packet.t === 'READY') sessions.set(shardId, createHash('sha256').update(packet.d.session_id).digest('hex').slice(0, 24));
    contexts.set(shardId, { prefix: `${sessions.get(shardId) ?? 'initial'}:${shardId}:${packet.s}`, receivedAt: new Date() });
  });
  const receive = (guild: Guild, type: ServerEvent['type'], entityId: string, channelId: string | null, metadata: EventMetadata, eventAt: Date | null = null) => {
    if (!core.modules.isRunning(guild.id, 'PT-01') && !((type === 'member.join' || type === 'member.leave') && core.modules.isRunning(guild.id, 'PT-02'))) return;
    const context = contexts.get(guild.shardId) ?? { prefix: randomUUID(), receivedAt: new Date() };
    void router.dispatch({ guildId: guild.id, entityId, channelId, type, eventKey: `${context.prefix}:${type}:${entityId}`, metadata: { guildName: guild.name, ...metadata }, receivedAt: context.receivedAt, eventAt });
  };
  const memberData = (guild: Guild, user: { id: string; username: string; createdAt: Date; displayAvatarURL(): string }): EventMetadata => ({ userId: user.id, userName: user.username, avatar: user.displayAvatarURL(), memberCount: guild.memberCount, accountCreatedAt: user.createdAt.toISOString() });
  client.on(Events.GuildMemberAdd, (member) => receive(member.guild, 'member.join', member.id, null, memberData(member.guild, member.user), member.joinedAt));
  client.on(Events.GuildMemberRemove, (member) => receive(member.guild, 'member.leave', member.id, null, memberData(member.guild, member.user)));
  client.on(Events.GuildMemberUpdate, (before, after) => {
    if (before.partial) {
      receive(after.guild, 'member.update', after.id, null, { ...memberData(after.guild, after.user), before: 'Unavailable', after: summary({ nickname: after.nickname, roles: [...after.roles.cache.keys()] }) });
      return; // 不把缺失的舊快取推定成所有身分組都新增。
    }
    for (const change of memberDifferences({ nickname: before.nickname, roles: [...before.roles.cache.keys()] }, { nickname: after.nickname, roles: [...after.roles.cache.keys()] })) receive(after.guild, change.type, after.id, null, { ...memberData(after.guild, after.user), before: change.before, after: change.after });
  });
  client.on(Events.VoiceStateUpdate, (before, after) => {
    const type = voiceTransition(before.channelId, after.channelId);
    if (!type) return;
    const user = after.member?.user ?? before.member?.user;
    receive(after.guild, type, after.id, after.channelId ?? before.channelId, { ...(user ? memberData(after.guild, user) : { userId: after.id }), before: before.channelId ?? '未連線', after: after.channelId ?? '未連線' });
  });
  client.on(Events.GuildRoleCreate, (role) => receive(role.guild, 'role.create', role.id, null, { entityName: role.name }, role.createdAt));
  client.on(Events.GuildRoleDelete, (role) => receive(role.guild, 'role.delete', role.id, null, { entityName: role.name }));
  client.on(Events.GuildRoleUpdate, (before, after) => {
    const properties = (role: typeof after) => summary({ name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable });
    if (properties(before) !== properties(after)) receive(after.guild, 'role.update', after.id, null, { entityName: after.name, before: properties(before), after: properties(after) });
    if (before.permissions.bitfield !== after.permissions.bitfield) receive(after.guild, 'role.permissions', after.id, null, { entityName: after.name, before: before.permissions.bitfield.toString(), after: after.permissions.bitfield.toString() });
  });
  client.on(Events.ChannelCreate, (channel) => { if ('guild' in channel) receive(channel.guild, 'channel.create', channel.id, channel.id, { entityName: channel.name }, channel.createdAt); });
  client.on(Events.ChannelDelete, (channel) => { if ('guild' in channel) receive(channel.guild, 'channel.delete', channel.id, channel.id, { entityName: channel.name }); });
  client.on(Events.ChannelUpdate, (before, after) => {
    if (!('guild' in before) || !('guild' in after)) return;
    const properties = (channel: typeof after) => summary({ name: channel.name, type: channel.type, parentId: channel.parentId,
      ...('topic' in channel ? { topic: channel.topic } : {}), ...('nsfw' in channel ? { nsfw: channel.nsfw } : {}), ...('rateLimitPerUser' in channel ? { rateLimitPerUser: channel.rateLimitPerUser } : {}) });
    if (properties(before) !== properties(after)) receive(after.guild, 'channel.update', after.id, after.id, { entityName: after.name, before: properties(before), after: properties(after) });
    const overwrites = (channel: typeof after) => 'permissionOverwrites' in channel ? summary([...channel.permissionOverwrites.cache.values()].map((value) => ({ id: value.id, type: value.type, allow: value.allow.bitfield.toString(), deny: value.deny.bitfield.toString() })).sort((a, b) => a.id.localeCompare(b.id))) : 'Unavailable';
    if (overwrites(before) !== overwrites(after)) receive(after.guild, 'channel.permissions', after.id, after.id, { entityName: after.name, before: overwrites(before), after: overwrites(after) });
  });
  client.on(Events.GuildUpdate, (before, after) => {
    const properties = (guild: Guild) => summary({ name: guild.name, verificationLevel: guild.verificationLevel, defaultMessageNotifications: guild.defaultMessageNotifications, features: [...guild.features].sort() });
    if (properties(before) !== properties(after)) receive(after, 'guild.update', after.id, null, { before: properties(before), after: properties(after) });
  });
  for (const event of [Events.InviteCreate, Events.InviteDelete] as const) client.on(event, (invite) => {
    const guild = invite.guild ? client.guilds.cache.get(invite.guild.id) : undefined;
    if (guild) receive(guild, event === Events.InviteCreate ? 'invite.create' : 'invite.delete', invite.channel?.id ?? guild.id, invite.channel?.id ?? null, { entityName: '邀請（不保存邀請碼）' }, event === Events.InviteCreate ? invite.createdAt : null);
  });
}
