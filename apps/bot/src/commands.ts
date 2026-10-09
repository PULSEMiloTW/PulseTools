import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { moduleIds } from '../../../packages/shared/src/models.js';

const base = (name: string, description: string) => new SlashCommandBuilder().setName(name).setDescription(description)
  .setContexts(InteractionContextType.Guild).setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
export const commands = [
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
