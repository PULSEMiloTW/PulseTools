import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { moduleIds, messageEventTypes } from '../../../packages/shared/src/models.js';

const base = (name: string, description: string) => new SlashCommandBuilder().setName(name).setDescription(description)
  .setContexts(InteractionContextType.Guild).setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
export const commands = [
  base('logs', '訊息 Audit 與原文保存政策')
    .addSubcommand((s) => s.setName('status').setDescription('查看本 Guild 紀錄政策與事件接收狀態'))
    .addSubcommand((s) => s.setName('recent').setDescription('查看最近十筆事件中繼資料'))
    .addSubcommand((s) => s.setName('snapshot').setDescription('授權者查看訊息原文與版本').addStringOption((o) => o.setName('message_id').setDescription('訊息 ID').setRequired(true)))
    .addSubcommandGroup((g) => g.setName('event').setDescription('事件政策').addSubcommand((s) => s.setName('set').setDescription('開關一種訊息事件')
      .addStringOption((o) => o.setName('type').setDescription('事件').setRequired(true).addChoices(...messageEventTypes.map((value) => ({ name: value, value }))))
      .addBooleanOption((o) => o.setName('enabled').setDescription('是否記錄').setRequired(true))))
    .addSubcommandGroup((g) => g.setName('retention').setDescription('保存期限').addSubcommand((s) => s.setName('set').setDescription('設定事件與原文保存天數')
      .addIntegerOption((o) => o.setName('days').setDescription('1–365 天；縮短後下一次清理會移除過期資料').setRequired(true).setMinValue(1).setMaxValue(365))))
    .addSubcommandGroup((g) => g.setName('capture').setDescription('原文保存政策')
      .addSubcommand((s) => s.setName('enable').setDescription('明確確認並公告後啟用指定頻道原文保存')
        .addChannelOption((o) => o.setName('channel').setDescription('保存原文的文字頻道；將在此發送隱私告知').setRequired(true))
        .addStringOption((o) => o.setName('notice').setDescription('說明保存目的、期限與可見對象').setRequired(true).setMaxLength(1500))
        .addBooleanOption((o) => o.setName('confirm').setDescription('確認公開告知並啟用原文保存').setRequired(true)))
      .addSubcommand((s) => s.setName('disable').setDescription('停止保存新原文並關閉原文查閱'))
      .addSubcommand((s) => s.setName('exclude').setDescription('排除頻道；即刻停止保存及查閱')
        .addChannelOption((o) => o.setName('channel').setDescription('排除頻道').setRequired(true)))
      .addSubcommand((s) => s.setName('viewer').setDescription('設定此 Guild 原文查看者（仍需內部與原生管理員權限）')
        .addUserOption((o) => o.setName('user').setDescription('成員').setRequired(true))
        .addBooleanOption((o) => o.setName('enabled').setDescription('允許或撤銷').setRequired(true)))),
  base('pulse', 'PulseTools 初始化檢查').addSubcommand((s) => s.setName('setup').setDescription('檢查授權、資料庫與 Bot 基礎權限')),
  base('system', 'PulseTools 系統資訊')
    .addSubcommand((s) => s.setName('status').setDescription('查看本次程序實際狀態'))
    .addSubcommand((s) => s.setName('ping').setDescription('查看 Gateway 延遲'))
    .addSubcommand((s) => s.setName('uptime').setDescription('查看本次程序運作時間'))
    .addSubcommand((s) => s.setName('modules').setDescription('查看模組狀態'))
    .addSubcommand((s) => s.setName('diagnostics').setDescription('Owner 資料庫診斷')),
  base('owner', 'PulseTools Owner 管理')
    .addSubcommand((s) => s.setName('status').setDescription('查看 Owner 安全模式'))
    .addSubcommand((s) => s.setName('lockdown').setDescription('設定緊急安全模式').addBooleanOption((o) => o.setName('enabled').setDescription('啟用或解除').setRequired(true)))
    .addSubcommandGroup((g) => g.setName('guild').setDescription('Guild Allowlist')
      .addSubcommand((s) => s.setName('list').setDescription('列出已授權 Guild'))
      .addSubcommand((s) => s.setName('allow').setDescription('授權 Bot 已加入的 Guild').addStringOption((o) => o.setName('guild_id').setDescription('Guild ID').setRequired(true)))
      .addSubcommand((s) => s.setName('deny').setDescription('撤銷 Guild 業務授權並保留歷史').addStringOption((o) => o.setName('guild_id').setDescription('Guild ID').setRequired(true))))
    .addSubcommandGroup((g) => g.setName('operator').setDescription('指定 Guild 的操作員')
      .addSubcommand((s) => s.setName('add').setDescription('授權目前 Guild 的成員')
        .addUserOption((o) => o.setName('user').setDescription('成員').setRequired(true))
        .addStringOption((o) => o.setName('role').setDescription('內部角色').setRequired(true).addChoices({ name: '授權管理員', value: 'admin' }, { name: '管理員工具操作員', value: 'moderator' })))
      .addSubcommand((s) => s.setName('remove').setDescription('撤銷目前 Guild 操作員').addUserOption((o) => o.setName('user').setDescription('成員').setRequired(true)))),
  base('config', 'Guild 設定中心')
    .addSubcommand((s) => s.setName('view').setDescription('查看目前 Guild 設定'))
    .addSubcommand((s) => s.setName('export').setDescription('匯出不含 Secret 的 Guild 設定'))
    .addSubcommand((s) => s.setName('timezone').setDescription('修改顯示時區').addStringOption((o) => o.setName('value').setDescription('例如 Asia/Taipei').setRequired(true).setMaxLength(100)))
    .addSubcommand((s) => s.setName('language').setDescription('查看目前支援語言'))
    .addSubcommand((s) => s.setName('channel').setDescription('設定通知用途的頻道')
      .addStringOption((o) => o.setName('purpose').setDescription('用途').setRequired(true).addChoices(
        { name: '系統', value: 'system' }, { name: '成員', value: 'member' }, { name: '訊息', value: 'message' },
        { name: '語音', value: 'voice' }, { name: '管理', value: 'moderation' }, { name: '錯誤', value: 'error' }))
      .addChannelOption((o) => o.setName('channel').setDescription('此 Guild 的可發送文字頻道').setRequired(true)))
    .addSubcommandGroup((g) => g.setName('guild').setDescription('Guild 狀態')
      .addSubcommand((s) => s.setName('status').setDescription('查看授權與設定版本'))
      .addSubcommand((s) => s.setName('overview').setDescription('查看設定與模組概況'))),
  base('module', 'Guild 模組管理')
    .addSubcommand((s) => s.setName('list').setDescription('查看所有模組狀態'))
    .addSubcommand((s) => s.setName('health').setDescription('查看模組健康'))
    .addSubcommand((s) => s.setName('info').setDescription('查看模組詳細資訊').addStringOption((o) => o.setName('id').setDescription('模組 ID').setRequired(true).addChoices(...moduleIds.map((id) => ({ name: id, value: id })))))
    .addSubcommand((s) => s.setName('enable').setDescription('啟用目前 Guild 的模組').addStringOption((o) => o.setName('id').setDescription('模組 ID').setRequired(true).addChoices(...moduleIds.map((id) => ({ name: id, value: id })))))
    .addSubcommand((s) => s.setName('disable').setDescription('停用模組介面，保留必要 Core 授權與管理').addStringOption((o) => o.setName('id').setDescription('模組 ID').setRequired(true).addChoices(...moduleIds.map((id) => ({ name: id, value: id }))))),
];
