import { AttachmentBuilder, MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction, type Client } from 'discord.js';
import type { Core } from '../../../packages/core/src/index.js';
import type { AuditService } from '../../../packages/core/src/audit-service.js';
import { pulseEmbed, allowedMentions } from '../../../packages/embed-system/src/index.js';
import { guildConfigurationSchema, moduleIdSchema, snowflake, internalRoleSchema, auditEventTypeSchema, auditEventTypes, logCategories, type Actor, type ChannelPurpose } from '../../../packages/shared/src/models.js';
import { PulseError, safeErrorCode } from '../../../packages/shared/src/errors.js';
import { formatTimestamp, receivedTimestamp } from '../../../packages/shared/src/timestamp.js';
import type { PostgresNotificationRepository } from '../../../packages/database/src/notification-repository.js';
import { notificationTextChannel, notificationTestMetadata, welcomeCommand } from './notification-commands.js';
import { categoryFor, type NotificationPayload } from '../../../packages/shared/src/server-events.js';
import type { ModerationService } from '../../../packages/core/src/moderation-service.js';
import { moderationCommand } from './moderation-commands.js';
import type { ErrorService } from '../../../packages/core/src/error-service.js';
import type { HealthMonitor } from '../../../packages/core/src/health-monitor.js';
import type { ErrorInput } from '../../../packages/shared/src/monitoring.js';
import { errorCategory } from '../../../packages/shared/src/monitoring.js';
import { readConfigurationAttachment } from './configuration-import.js';
import { moderationActions } from '../../../packages/shared/src/moderation.js';

export interface BotRuntime { startedAt: Date; client: Client; core: Core; audit?: AuditService; moderation?: ModerationService; errors?: ErrorService; health?: HealthMonitor; recordError?: (error: ErrorInput) => Promise<void>; notifications?: PostgresNotificationRepository; wakeNotifications?: () => void; messageEventsEnabled?: boolean; memberEventsEnabled?: boolean }
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
    let preview: ReturnType<typeof pulseEmbed> | undefined;
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
      if (interaction.commandName === 'mod') await core.permissions.requireModerator(actor);
      else await core.permissions.requireAdmin(actor);
      if (interaction.commandName === 'mod') {
        if (!runtime.moderation) throw new PulseError('MODULE_UNAVAILABLE');
        title = '管理案件';
        if (sub === 'notifications') {
          await core.permissions.requireAdmin(actor, true);
          if (!(await core.modules.enabled(actor.guildId, 'PT-04'))) throw new PulseError('MODULE_UNAVAILABLE');
          const action = interaction.options.getString('action', true);
          if (!moderationActions.some((a) => a === action)) throw new PulseError('INVALID_INPUT');
          const guild = await core.configuration.view(actor);
          const notifyActions = guild.configuration.moderation.notifyActions.filter((a) => a !== action);
          if (interaction.options.getBoolean('enabled', true)) notifyActions.push(action as typeof moderationActions[number]);
          await core.configuration.replace(actor, { ...guild.configuration, moderation: { notifyActions } }, guild.revision);
          description = '案件通知開關已更新；案件仍保存於資料庫。';
        } else {
        description = await moderationCommand(interaction, actor, runtime.moderation);
        runtime.wakeNotifications?.();
        }
      } else if (interaction.commandName === 'error') {
        if (!runtime.errors) throw new PulseError('MODULE_UNAVAILABLE');
        title = '錯誤中心';
        const global = interaction.options.getBoolean('global') ?? false;
        if (sub === 'acknowledge') {
          await runtime.errors.acknowledge(actor, interaction.options.getString('id', true), global);
          description = '錯誤已確認，紀錄與發生次數保留。';
        } else if (sub === 'detail') {
          const record = await runtime.errors.detail(actor, interaction.options.getString('id', true), global);
          description = `Error ID：${record.id}\n模組：${record.moduleId}\n類型：${record.type}\n代碼：${record.code}\n摘要：${record.summary}\n首次發生：${formatTimestamp(record.occurredAt)}\n首次接收：${formatTimestamp(record.receivedAt)}\n最後發生：${formatTimestamp(record.lastOccurredAt)}\n時區：Asia/Taipei\n次數：${record.count}\n狀態：${record.status}\n確認者：${record.acknowledgedBy ?? '無'}\n原始例外與 Stack Trace 不保存。`;
        } else if (sub === 'stats') description = (await runtime.errors.stats(actor, global)).map((r) => `${r.status} · ${r.groups} 組 · ${r.count} 次`).join('\n') || '無錯誤紀錄。';
        else description = (await runtime.errors.list(actor, global)).map((r) => `${r.id} · ${r.moduleId} · ${r.code} · ${r.status} · ${r.count} 次 · ${formatTimestamp(r.lastOccurredAt)}（Asia/Taipei）`).join('\n') || '無錯誤紀錄。';
      } else if (interaction.commandName === 'module' || (interaction.commandName === 'system' && sub === 'modules')) {
        title = '模組管理';
        if (sub === 'enable' || sub === 'disable') {
          const id = moduleIdSchema.parse(interaction.options.getString('id', true));
          if (id === 'PT-01' && sub === 'enable' && !runtime.messageEventsEnabled) throw new PulseError('MODULE_UNAVAILABLE');
          if (id === 'PT-02' && sub === 'enable' && !runtime.memberEventsEnabled) throw new PulseError('MODULE_UNAVAILABLE');
          await core.modules.setEnabled(actor, id, sub === 'enable');
          description = '模組狀態已更新。Core 授權、設定、錯誤邊界保持運作。';
        } else if (sub === 'info') {
          const module = core.modules.definition(moduleIdSchema.parse(interaction.options.getString('id', true)));
          description = `${module.id} · ${module.name}\n${module.description}\n版本：${module.version}\n依賴：${module.dependencies.join('、') || '無'}\n必要權限：${module.requiredPermissions.join('、') || '由 Core 驗證'}\nGateway Intents：${module.requiredGatewayIntents.join('、')}`;
        } else description = (await (sub === 'health' ? core.modules.health(actor) : core.modules.list(actor))).map((module) => `${module.id} ${module.name} · ${module.health}`).join('\n');
      } else if (interaction.commandName === 'welcome') {
        title = '成員通知';
        const result = await welcomeCommand(interaction, actor, runtime);
        description = result.description;
        preview = result.preview;
      } else if (interaction.commandName === 'logs') {
        if (!runtime.audit || !(await core.modules.enabled(actor.guildId, 'PT-01'))) throw new PulseError('MODULE_UNAVAILABLE');
        title = '訊息 Audit';
        let guild = await core.configuration.view(actor);
        let notificationResult: string | undefined;
        if (group === 'channel') {
          if (sub === 'set') {
            await core.permissions.requireAdmin(actor, true);
            const category = interaction.options.getString('category', true) as typeof logCategories[number];
            if (!logCategories.includes(category)) throw new PulseError('INVALID_INPUT');
            const channel = await notificationTextChannel(interaction);
            guild = await core.configuration.setChannel(actor, category, channel.id);
          }
          notificationResult = Object.entries(guild.configuration.channels).map(([type, id]) => `${type} → ${id}`).join('\n') || '尚未設定通知頻道；事件仍可保存於資料庫。';
        } else if (sub === 'test') {
          await core.permissions.requireAdmin(actor, true);
          if (!runtime.notifications) throw new PulseError('MODULE_UNAVAILABLE');
          const types: Record<string, NotificationPayload['eventType']> = { member: 'member.join', message: 'message.update', voice: 'voice.join', system: 'guild.update' };
          const type = types[interaction.options.getString('category', true)];
          if (!type) throw new PulseError('INVALID_INPUT');
          const channel = await runtime.notifications.test(actor.guildId, 'PT-01', type, notificationTestMetadata(interaction));
          runtime.wakeNotifications?.();
          notificationResult = `測試通知已排入頻道 ${channel} 的發送佇列，非實際事件。`;
        } else if (group === 'capture') {
          await core.permissions.requireAdmin(actor, true);
          const capture = { ...guild.configuration.capture };
          if (sub === 'enable') {
            if (!runtime.messageEventsEnabled || interaction.options.getBoolean('confirm', true) !== true) throw new PulseError('INVALID_INPUT');
            const selected = interaction.options.getChannel('channel', true);
            const channel = await interaction.guild?.channels.fetch(selected.id);
            const botMember = interaction.guild?.members.me;
            const notice = interaction.options.getString('notice', true).trim();
            if (!notice || !channel?.isTextBased() || !('send' in channel) || !botMember || !channel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) throw new PulseError('INVALID_INPUT');
            capture.enabled = true;
            capture.allowedChannels = [...new Set([...capture.allowedChannels, channel.id])];
            capture.excludedChannels = capture.excludedChannels.filter((id) => id !== channel.id);
            capture.privacyNotice = notice;
            if (!guildConfigurationSchema.safeParse({ ...guild.configuration, capture }).success) throw new PulseError('INVALID_INPUT');
            // 此公開訊息只在使用者明確提交 confirm:true 的指令時發送。
            await channel.send({ embeds: [pulseEmbed({ title: '訊息原文保存告知', description: `${notice}\n保存期限：${capture.retentionDays} 天\n查看對象：Owner 與此 Guild 明確授權且具管理員權限的查看者。` })], allowedMentions });
          } else if (sub === 'disable') capture.enabled = false;
          else if (sub === 'exclude') capture.excludedChannels = [...new Set([...capture.excludedChannels, interaction.options.getChannel('channel', true).id])];
          else if (sub === 'viewer') {
            const user = interaction.options.getUser('user', true);
            if (user.bot || !(await interaction.guild?.members.fetch(user.id).catch(() => null))) throw new PulseError('INVALID_INPUT');
            capture.viewerIds = interaction.options.getBoolean('enabled', true) ? [...new Set([...capture.viewerIds, user.id])] : capture.viewerIds.filter((id) => id !== user.id);
          }
          guild = await core.configuration.setCapture(actor, capture, sub === 'enable', guild.revision);
        } else if (group === 'event') {
          const types = sub === 'category' ? auditEventTypes.filter((type) => categoryFor(type) === interaction.options.getString('category', true)) : [auditEventTypeSchema.parse(interaction.options.getString('type', true))];
          if (!types.length) throw new PulseError('INVALID_INPUT');
          const enabledEvents = interaction.options.getBoolean('enabled', true) ? [...new Set([...guild.configuration.audit.enabledEvents, ...types])] : guild.configuration.audit.enabledEvents.filter((value) => !types.includes(value));
          guild = await core.configuration.setAudit(actor, { ...guild.configuration.audit, enabledEvents }, guild.revision);
        } else if (group === 'retention') {
          const days = interaction.options.getInteger('days', true);
          guild = await core.configuration.replace(actor, { ...guild.configuration, audit: { ...guild.configuration.audit, retentionDays: days }, capture: { ...guild.configuration.capture, retentionDays: days } }, guild.revision);
        }
        if (notificationResult) description = notificationResult;
        else if (sub === 'recent') description = (await runtime.audit.recent(actor)).map((event) => `${event.eventType} · ${event.entityId} · ${event.captureStatus}\n${formatTimestamp(event.eventAt, guild.configuration.timezone)} · 來源 ${event.timestampSource} · 操作者 ${event.attribution}`).join('\n') || '尚無事件。';
        else if (sub === 'snapshot') {
          const result = await runtime.audit.snapshot(actor, interaction.options.getString('message_id', true));
          description = result ? `訊息：${result.snapshot.messageId}\n狀態：${result.snapshot.captureStatus}\n版本：${result.snapshot.revision}` : 'Unavailable：沒有可用且未過期的原文。';
          if (result) files = [new AttachmentBuilder(Buffer.from(JSON.stringify(result, null, 2), 'utf8'), { name: `snapshot-${result.snapshot.messageId}.json` })];
        } else description = `Gateway 訊息接收：${runtime.messageEventsEnabled ? '已啟用' : '未啟用'}\n事件：${guild.configuration.audit.enabledEvents.join('、') || '全部關閉'}\n原文保存：${guild.configuration.capture.enabled ? '啟用' : '關閉'}\n指定頻道：${guild.configuration.capture.allowedChannels.join('、') || '無'}\n排除頻道：${guild.configuration.capture.excludedChannels.join('、') || '無'}\n事件保存：${guild.configuration.audit.retentionDays} 天\n原文保存：${guild.configuration.capture.retentionDays} 天\n缺失原文標記 Unavailable；不推定刪除操作者。`;
        if (sub === 'status' && runtime.notifications) {
          description += `\n成員事件接收：${runtime.memberEventsEnabled ? '啟用' : '未啟用'}\n通知佇列：${(await runtime.notifications.status(actor.guildId)).map((row) => `${row.status} ${row.count}`).join('、') || '無紀錄'}`;
          const failures = await runtime.notifications.failures(actor.guildId);
          if (failures.length) description += `\n最近失敗：${failures.map((row) => `${row.errorCode} · 頻道 ${row.channelId}`).join('；')}`;
        }
      } else if (interaction.commandName === 'config') {
        if (!(await core.modules.enabled(actor.guildId, 'PT-03'))) throw new PulseError('MODULE_UNAVAILABLE');
        title = 'Guild 設定中心';
        if (sub === 'import') {
          await core.permissions.requireAdmin(actor, true);
          if (interaction.options.getBoolean('confirm', true) !== true) throw new PulseError('INVALID_INPUT');
          const configuration = await readConfigurationAttachment(interaction.options.getAttachment('file', true));
          const routes = [...Object.values(configuration.channels), configuration.welcome.joinChannel, configuration.welcome.leaveChannel].filter((id): id is string => Boolean(id));
          for (const id of new Set([...routes, ...configuration.capture.allowedChannels, ...configuration.capture.excludedChannels])) {
            const channel = await interaction.guild?.channels.fetch(id);
            if (!channel || !channel.isTextBased()) throw new PulseError('INVALID_INPUT');
            if (routes.includes(id)) {
              const me = interaction.guild?.members.me;
              if (!me || !('send' in channel) || !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) throw new PulseError('INVALID_INPUT');
            }
          }
          await core.configuration.replace(actor, configuration, interaction.options.getInteger('revision', true));
        }
        if (sub === 'reset') await core.configuration.reset(actor, interaction.options.getInteger('revision', true), interaction.options.getBoolean('confirm', true));
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
        description = `Guild 已授權\n資料庫：${await core.repository.health() ? '連線正常' : '不可用'}\nGateway Intents：Guilds、GuildVoiceStates、GuildInvites${runtime.messageEventsEnabled ? '、GuildMessages、MessageContent' : '（訊息接收未啟用）'}${runtime.memberEventsEnabled ? '、GuildMembers' : '（成員接收未啟用）'}\nBot 基礎訊息權限：${canSend ? '具備' : '不足或無法確認'}\n使用 /module enable 啟用 PT-01、PT-02、PT-03；通知需另設定頻道路由。`;
      } else if (interaction.commandName === 'system') {
        if (sub === 'diagnostics') core.permissions.requireOwner(actor.userId);
        if (runtime.health) {
          if (sub === 'history') description = (await runtime.health.history(actor)).map((s) => `${formatTimestamp(s.sampledAt)}（Asia/Taipei） · ${s.metrics.botStatus} · DB ${s.metrics.databaseHealthy ? '正常' : '異常'} · Uptime ${Math.floor(s.metrics.uptimeSeconds)} 秒`).join('\n') || '沒有健康樣本；啟用 PT-05 後每分鐘採樣。';
          else {
            const m = await runtime.health.status(actor);
            description = `PulseTools v0.1.0 · ${m.botStatus}\n運作時間：${Math.floor(m.uptimeSeconds)} 秒\n程序開始：${formatTimestamp(new Date(m.startedAt))}（Asia/Taipei）\n已加入／已授權 Guild：${m.guildCount}／${m.authorizedGuildCount ?? 'Unavailable'}\n本 Guild 運作模組：${m.activeModuleCount ?? 'Unavailable'}\nGateway：${m.gatewayPingMs ?? 'Unavailable'} ms\nREST API：${m.apiLatencyMs === null ? 'Unavailable' : m.apiLatencyMs.toFixed(1)} ms\nDatabase：${m.databaseHealthy ? '正常' : '異常'} · ${m.databaseLatencyMs === null ? 'Unavailable' : m.databaseLatencyMs.toFixed(1)} ms\nCPU（單核心基準）：${m.cpuPercent.toFixed(1)}%\n記憶體 RSS／Heap：${Math.round(m.rssBytes / 1048576)}／${Math.round(m.heapBytes / 1048576)} MiB\n本 Guild 錯誤次數：${m.errorCount ?? 'Unavailable'}\n通知待發／失敗：${m.pendingNotifications ?? 'Unavailable'}／${m.failedNotifications ?? 'Unavailable'}`;
          }
        } else {
        const modules = await core.modules.list(actor);
        description = `PulseTools v0.1.0 · ${client.isReady() ? 'Online' : 'Degraded'}\n運作時間：${Math.floor((Date.now() - runtime.startedAt.getTime()) / 1000)} 秒\n實際已加入 Guild：${client.guilds.cache.size}\n已授權 Guild：${(await core.repository.authorizedGuilds()).length}\nGateway Ping：${client.ws.ping} ms\n本 Guild 運作模組：${modules.filter((module) => module.health === 'Running').length}\n程序開始：${formatTimestamp(runtime.startedAt)}（Asia/Taipei）`;
        if (sub === 'diagnostics') description += `\n資料庫：${await core.repository.health() ? '正常' : '不可用'}\n記憶體 RSS：${Math.round(process.memoryUsage().rss / 1024 / 1024)} MiB`;
        }
      } else throw new PulseError('INVALID_INPUT');
      // 已授權 Guild 的管理查詢也留存存取歷史，不包含訊息原文或機密。
      await core.repository.recordEvent({ guildId: actor.guildId, actorId: actor.userId, action: 'command.access', details: { command: interaction.commandName, subcommand: sub }, ...receivedTimestamp() });
    }
    await interaction.editReply({ embeds: [preview ?? pulseEmbed({ title, description })], files, allowedMentions });
  } catch (error) {
    const code = safeErrorCode(error);
    console.error(`[PulseTools] 指令失敗：${code}`);
    if (runtime.recordError) {
      try { await runtime.recordError({ guildId: interaction.guildId, moduleId: interaction.commandName === 'mod' ? 'PT-04' : interaction.commandName === 'error' ? 'PT-08' : null, type: errorCategory(error), code: code as ErrorInput['code'], occurredAt: new Date() }); }
      catch { console.error('[PulseTools] ERROR_PERSIST_FAILED'); }
    }
    const embed = pulseEmbed({ title: '操作未完成', description: error instanceof PulseError ? error.message : '此操作未完成，請檢查服務狀態。機密與原始錯誤不會公開。', kind: 'error' });
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], allowedMentions });
      else await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions });
    } catch { console.error('[PulseTools] 無法發送指令回覆。'); }
  }
}
