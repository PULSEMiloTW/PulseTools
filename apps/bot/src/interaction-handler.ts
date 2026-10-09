import { AttachmentBuilder, MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction, type Client } from 'discord.js';
import type { Core } from '../../../packages/core/src/index.js';
import { pulseEmbed, allowedMentions } from '../../../packages/embed-system/src/index.js';
import { moduleIdSchema, snowflake, internalRoleSchema, type Actor, type ChannelPurpose } from '../../../packages/shared/src/models.js';
import { PulseError, safeErrorCode } from '../../../packages/shared/src/errors.js';
import { formatTimestamp, receivedTimestamp } from '../../../packages/shared/src/timestamp.js';

export interface BotRuntime { startedAt: Date; client: Client; core: Core }
export async function handleCommand(interaction: ChatInputCommandInteraction, runtime: BotRuntime) {
  const { core, client } = runtime;
  try {
    // 所有管理回覆均為 Ephemeral；先 defer 避免 DB 與 Discord API 超過三秒。
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guildId) throw new PulseError('GUILD_DENIED');
    const actor: Actor = { userId: interaction.user.id, guildId: interaction.guildId, nativeAdministrator: interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false };
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    let title = 'PulseTools';
    let description = '';
    let files: AttachmentBuilder[] = [];
    const owner = interaction.commandName === 'owner';
    if (owner) {
      core.permissions.requireOwner(actor.userId);
      title = 'Owner 存取控制';
      if (group === 'guild') {
        if (sub === 'list') description = (await core.guilds.list(actor.userId)).map((guild) => `${guild.name} · ${guild.id}`).join('\n') || '尚未授權任何 Guild。';
        else {
          const id = interaction.options.getString('guild_id', true);
          if (!snowflake.safeParse(id).success) throw new PulseError('INVALID_INPUT');
          const guild = client.guilds.cache.get(id);
          if (sub === 'allow' && !guild) throw new PulseError('INVALID_INPUT');
          await core.guilds.setAuthorization(actor.userId, id, guild?.name ?? '未加入的 Guild', sub === 'allow');
          description = sub === 'allow' ? 'Guild 已授權。功能模組預設停用，原文保存預設關閉。' : 'Guild 授權已撤銷；歷史資料保留。';
        }
      } else if (group === 'operator') {
        const user = interaction.options.getUser('user', true);
        if (sub === 'add') {
          if (user.bot || !interaction.guild || !(await interaction.guild.members.fetch(user.id).catch(() => null))) throw new PulseError('INVALID_INPUT');
        }
        const role = sub === 'add' ? internalRoleSchema.parse(interaction.options.getString('role', true)) : null;
        await core.guilds.setOperator(actor.userId, actor.guildId, user.id, role);
        description = '此 Guild 的操作員授權已更新。';
      } else if (sub === 'lockdown') {
        await core.repository.setLockdown(interaction.options.getBoolean('enabled', true), actor.userId);
        description = `緊急安全模式：${await core.repository.lockdown() ? '已啟用' : '已解除'}`;
      } else description = `Owner 身分驗證通過。緊急安全模式：${await core.repository.lockdown() ? '已啟用' : '未啟用'}`;
    } else {
      await core.permissions.requireAdmin(actor);
      if (interaction.commandName === 'module' || (interaction.commandName === 'system' && sub === 'modules')) {
        title = '模組管理';
        if (sub === 'enable' || sub === 'disable') {
          await core.modules.setEnabled(actor, moduleIdSchema.parse(interaction.options.getString('id', true)), sub === 'enable');
          description = '模組狀態已更新。Core 授權、設定、錯誤邊界保持運作。';
        } else if (sub === 'info') {
          const module = core.modules.definition(moduleIdSchema.parse(interaction.options.getString('id', true)));
          description = `${module.id} · ${module.name}\n${module.description}\n版本：${module.version}\n依賴：${module.dependencies.join('、') || '無'}\n必要權限：${module.requiredPermissions.join('、') || '由 Core 驗證'}\nGateway Intents：${module.requiredGatewayIntents.join('、')}`;
        } else description = (await core.modules.list(actor)).map((module) => `${module.id} ${module.name} · ${module.health}`).join('\n');
      } else if (interaction.commandName === 'config') {
        if (!(await core.modules.enabled(actor.guildId, 'PT-03'))) throw new PulseError('MODULE_UNAVAILABLE');
        title = 'Guild 設定中心';
        if (sub === 'timezone') await core.configuration.setTimezone(actor, interaction.options.getString('value', true));
        else if (sub === 'channel') {
          const selected = interaction.options.getChannel('channel', true);
          const channel = await interaction.guild?.channels.fetch(selected.id);
          const botMember = interaction.guild?.members.me;
          if (!channel?.isTextBased() || !('send' in channel) || !botMember || !channel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) throw new PulseError('INVALID_INPUT');
          await core.configuration.setChannel(actor, interaction.options.getString('purpose', true) as ChannelPurpose, channel.id);
        }
        const guild = await core.configuration.view(actor);
        if (sub === 'export') files = [new AttachmentBuilder(Buffer.from(JSON.stringify(guild.configuration, null, 2), 'utf8'), { name: `pulsetools-${guild.id}.json` })];
        description = `伺服器：${guild.name}\nGuild ID：${guild.id}\n設定版本：${guild.revision}\n時區：${guild.configuration.timezone}\n語言：${guild.configuration.language}\n原文保存：${guild.configuration.capture.enabled ? '已啟用' : '關閉'}\n最後更新：${formatTimestamp(guild.updatedAt, guild.configuration.timezone)}\n通知頻道：${Object.entries(guild.configuration.channels).map(([purpose, id]) => `${purpose}：${id}`).join('、') || '尚未設定'}`;
      } else if (interaction.commandName === 'pulse') {
        const me = interaction.guild?.members.me;
        const channel = interaction.channel;
        const canSend = me && channel && 'permissionsFor' in channel && channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]);
        description = `Guild 已授權\n資料庫：${await core.repository.health() ? '連線正常' : '不可用'}\nGateway Intent：Guilds（Phase 1）\nBot 基礎訊息權限：${canSend ? '具備' : '不足或無法確認'}\n使用 /module enable 啟用 PT-03 設定介面。\n其他功能依後續階段驗收逐步開放。`;
      } else if (interaction.commandName === 'system') {
        if (sub === 'diagnostics') core.permissions.requireOwner(actor.userId);
        const modules = await core.modules.list(actor);
        description = `PulseTools v0.1.0 · ${client.isReady() ? 'Online' : 'Degraded'}\n運作時間：${Math.floor((Date.now() - runtime.startedAt.getTime()) / 1000)} 秒\n實際已加入 Guild：${client.guilds.cache.size}\n已授權 Guild：${(await core.repository.authorizedGuilds()).length}\nGateway Ping：${client.ws.ping} ms\n本 Guild 運作模組：${modules.filter((module) => module.health === 'Running').length}\n程序開始：${formatTimestamp(runtime.startedAt)}（Asia/Taipei）`;
        if (sub === 'diagnostics') description += `\n資料庫：${await core.repository.health() ? '正常' : '不可用'}\n記憶體 RSS：${Math.round(process.memoryUsage().rss / 1024 / 1024)} MiB`;
      } else throw new PulseError('INVALID_INPUT');
      // 已授權 Guild 的管理查詢也留存存取歷史，不包含訊息原文或機密。
      await core.repository.recordEvent({ guildId: actor.guildId, actorId: actor.userId, action: 'command.access', details: { command: interaction.commandName, subcommand: sub }, ...receivedTimestamp() });
    }
    await interaction.editReply({ embeds: [pulseEmbed({ title, description })], files, allowedMentions });
  } catch (error) {
    const code = safeErrorCode(error);
    console.error(`[PulseTools] 指令失敗：${code}`);
    const embed = pulseEmbed({ title: '操作未完成', description: error instanceof PulseError ? error.message : '此操作未完成，請檢查服務狀態。機密與原始錯誤不會公開。', kind: 'error' });
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], allowedMentions });
      else await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions });
    } catch { console.error('[PulseTools] 無法發送指令回覆。'); }
  }
}
