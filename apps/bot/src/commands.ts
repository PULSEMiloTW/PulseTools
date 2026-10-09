import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, SlashCommandSubcommandBuilder, ChannelType } from 'discord.js';
import { moduleIds, auditEventTypes, logCategories } from '../../../packages/shared/src/models.js';
import { moderationActions } from '../../../packages/shared/src/moderation.js';

const base = (name: string, description: string) => new SlashCommandBuilder().setName(name).setDescription(description)
  .setContexts(InteractionContextType.Guild).setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
function withModerationActions(builder: Pick<SlashCommandBuilder, 'addSubcommand' | 'toJSON'>, subcommands: SlashCommandSubcommandBuilder[]) {
  for (const sub of subcommands) builder.addSubcommand(sub);
  return builder;
}
export const commands = [
  base('r2','雲端檔案上傳管理')
    .addSubcommandGroup(g=>g.setName('access').setDescription('Owner 手動授權上傳者')
      .addSubcommand(s=>s.setName('list').setDescription('列出此 Guild 上傳授權名單'))
      .addSubcommand(s=>s.setName('add').setDescription('加入此 Guild 上傳者').addUserOption(o=>o.setName('user').setDescription('目前 Guild 的成員').setRequired(true)))
      .addSubcommand(s=>s.setName('remove').setDescription('撤銷此 Guild 上傳者').addUserOption(o=>o.setName('user').setDescription('要撤銷的使用者').setRequired(true))))
    .addSubcommand(s=>s.setName('status').setDescription('此 Guild 的 R2 狀態'))
    .addSubcommand(s=>s.setName('test').setDescription('唯讀檢查指定 Bucket 連線'))
    .addSubcommand(s=>s.setName('files').setDescription('此 Guild 最近上傳請求'))
    .addSubcommandGroup(g=>g.setName('file').setDescription('檔案紀錄').addSubcommand(s=>s.setName('info').setDescription('檔案狀態與重新取得下載連結').addStringOption(o=>o.setName('id').setDescription('Request UUID').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('channel').setDescription('監聽頻道')
      .addSubcommand(s=>s.setName('list').setDescription('查看監聽頻道'))
      .addSubcommand(s=>s.setName('add').setDescription('新增監聽頻道').addChannelOption(o=>o.setName('channel').setDescription('Guild 文字頻道').setRequired(true).addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s=>s.setName('remove').setDescription('移除監聽頻道').addChannelOption(o=>o.setName('channel').setDescription('Guild 文字頻道').setRequired(true).addChannelTypes(ChannelType.GuildText))))
    .addSubcommand(s=>s.setName('config').setDescription('查看或更新此 Guild 上傳政策')
      .addStringOption(o=>o.setName('access').setDescription('下載模式').addChoices({name:'私人：一小時簽署連結',value:'private'},{name:'公開：永久形式 Custom Domain',value:'public'}))
      .addIntegerOption(o=>o.setName('max_mb').setDescription('每檔上限 MiB').setMinValue(1).setMaxValue(25))
      .addIntegerOption(o=>o.setName('max_files').setDescription('每則訊息檔案上限').setMinValue(1).setMaxValue(10))
      .addIntegerOption(o=>o.setName('prompt_seconds').setDescription('確認期限秒數').setMinValue(60).setMaxValue(900))
      .addStringOption(o=>o.setName('types').setDescription('逗號分隔：png,jpg,webp,gif,pdf,mp4,mp3,zip'))
      .addStringOption(o=>o.setName('prefix').setDescription('Object 前綴：英數、底線、連字號').setMaxLength(40))
      .addBooleanOption(o=>o.setName('allow_delete').setDescription('僅永久公開連結可啟用刪除'))
      .addBooleanOption(o=>o.setName('members').setDescription('是否允許授權名單成員提出上傳'))
      .addChannelOption(o=>o.setName('result_channel').setDescription('結果頻道；預設來源頻道').addChannelTypes(ChannelType.GuildText))),
  base('error', '安全錯誤中心')
    .addSubcommand((s) => s.setName('list').setDescription('查看最近十組安全錯誤').addBooleanOption((o) => o.setName('global').setDescription('Owner 全域診斷')))
    .addSubcommand((s) => s.setName('stats').setDescription('錯誤組數與發生次數').addBooleanOption((o) => o.setName('global').setDescription('Owner 全域診斷')))
    .addSubcommand((s) => s.setName('detail').setDescription('私密查看安全錯誤明細').addStringOption((o) => o.setName('id').setDescription('Error UUID').setRequired(true)).addBooleanOption((o) => o.setName('global').setDescription('Owner 全域診斷')))
    .addSubcommand((s) => s.setName('acknowledge').setDescription('確認錯誤，保留原紀錄').addStringOption((o) => o.setName('id').setDescription('Error UUID').setRequired(true)).addBooleanOption((o) => o.setName('global').setDescription('Owner 全域診斷'))),
  withModerationActions(base('mod', '管理案件與經確認的 Discord 管理操作')
    .addSubcommand((s) => s.setName('history').setDescription('查看此 Guild 的對象案件').addUserOption((o) => o.setName('user').setDescription('對象').setRequired(true)))
    .addSubcommand((s) => s.setName('detail').setDescription('私密查看案件與備註').addUserOption((o) => o.setName('user').setDescription('先選擇案件對象').setRequired(true)).addStringOption((o) => o.setName('case_id').setDescription('選擇此人的案件 ID 與時間').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('note').setDescription('新增案件備註').addUserOption((o) => o.setName('user').setDescription('先選擇案件對象').setRequired(true)).addStringOption((o) => o.setName('case_id').setDescription('選擇此人的案件 ID 與時間').setRequired(true).setAutocomplete(true)).addStringOption((o) => o.setName('text').setDescription('備註；請勿填入機密').setRequired(true).setMaxLength(1000)))
    .addSubcommand((s) => s.setName('notifications').setDescription('管理員切換個別案件操作的通知')
      .addStringOption((o) => o.setName('action').setDescription('案件操作').setRequired(true).addChoices(...moderationActions.map((value) => ({ name: value, value }))))
      .addBooleanOption((o) => o.setName('enabled').setDescription('是否通知').setRequired(true)))
    , moderationActions.map((action) => {
      const s = new SlashCommandSubcommandBuilder().setName(action).setDescription({ warn: '保存警告案件（不私訊）', timeout: '禁言成員', untimeout: '解除關聯案件的禁言', kick: '踢除成員', ban: '封鎖成員（不刪除訊息）', unban: '解除關聯案件的封鎖', purge: '清理目前頻道近期未釘選訊息' }[action]);
      if (action === 'purge') s.addIntegerOption((o) => o.setName('count').setDescription('最近 1–100 筆；跳過釘選與兩週前訊息').setRequired(true).setMinValue(1).setMaxValue(100));
      else if (action === 'unban') s.addStringOption((o) => o.setName('user_id').setDescription('已封鎖對象 ID').setRequired(true));
      else s.addUserOption((o) => o.setName('user').setDescription('此 Guild 成員').setRequired(true));
      if (action === 'timeout') s.addIntegerOption((o) => o.setName('minutes').setDescription('禁言分鐘數，上限 28 天').setRequired(true).setMinValue(1).setMaxValue(40320));
      if (action === 'unban' || action === 'untimeout') s.addStringOption((o) => o.setName('related_case_id').setDescription('選擇此人的原成功案件 ID 與時間').setRequired(true).setAutocomplete(true));
      return s.addStringOption((o) => o.setName('reason').setDescription('管理原因；請勿填入機密').setRequired(true).setMinLength(1).setMaxLength(400)).addBooleanOption((o) => o.setName('confirm').setDescription('明確確認本次操作').setRequired(true));
    })),
  base('welcome', '成員加入與離開通知')
    .addSubcommand((s) => s.setName('status').setDescription('查看成員通知設定'))
    .addSubcommand((s) => s.setName('preview').setDescription('私密預覽通知 Embed').addStringOption((o) => o.setName('direction').setDescription('通知類型').setRequired(true).addChoices({ name: '加入', value: 'join' }, { name: '離開', value: 'leave' })))
    .addSubcommand((s) => s.setName('test').setDescription('明確發送標示測試的成員通知至設定頻道').addStringOption((o) => o.setName('direction').setDescription('通知類型').setRequired(true).addChoices({ name: '加入', value: 'join' }, { name: '離開', value: 'leave' })))
    .addSubcommand((s) => s.setName('toggle').setDescription('切換一種成員通知').addStringOption((o) => o.setName('direction').setDescription('通知類型').setRequired(true).addChoices({ name: '加入', value: 'join' }, { name: '離開', value: 'leave' })).addBooleanOption((o) => o.setName('enabled').setDescription('是否通知').setRequired(true)))
    .addSubcommandGroup((g) => g.setName('channel').setDescription('獨立成員通知頻道').addSubcommand((s) => s.setName('set').setDescription('設定加入或離開通知頻道')
      .addStringOption((o) => o.setName('direction').setDescription('通知類型').setRequired(true).addChoices({ name: '加入', value: 'join' }, { name: '離開', value: 'leave' }))
      .addChannelOption((o) => o.setName('channel').setDescription('本 Guild 文字頻道').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))))
    .addSubcommandGroup((g) => g.setName('message').setDescription('自訂歡迎／離開文字').addSubcommand((s) => s.setName('set').setDescription('支援 {guild} {user} {user_id} {count} {account_created}')
      .addStringOption((o) => o.setName('direction').setDescription('通知類型').setRequired(true).addChoices({ name: '加入', value: 'join' }, { name: '離開', value: 'leave' }))
      .addStringOption((o) => o.setName('value').setDescription('自訂文字').setRequired(true).setMinLength(1).setMaxLength(1000))))
    .addSubcommand((s) => s.setName('account').setDescription('是否顯示帳號建立日期').addBooleanOption((o) => o.setName('enabled').setDescription('是否顯示').setRequired(true))),
  base('logs', '訊息 Audit 與原文保存政策')
    .addSubcommand((s) => s.setName('status').setDescription('查看本 Guild 紀錄政策與事件接收狀態'))
    .addSubcommand((s) => s.setName('recent').setDescription('查看最近十筆事件中繼資料'))
    .addSubcommand((s) => s.setName('test').setDescription('明確發送標示測試的事件通知').addStringOption((o) => o.setName('category').setDescription('紀錄分類').setRequired(true).addChoices(...logCategories.filter((value) => value !== 'moderation').map((value) => ({ name: value, value })))))
    .addSubcommandGroup((g) => g.setName('channel').setDescription('各分類事件通知頻道')
      .addSubcommand((s) => s.setName('list').setDescription('查看本 Guild 通知頻道路由'))
      .addSubcommand((s) => s.setName('set').setDescription('設定一種事件分類的紀錄頻道')
        .addStringOption((o) => o.setName('category').setDescription('分類').setRequired(true).addChoices(...logCategories.map((value) => ({ name: value, value }))))
        .addChannelOption((o) => o.setName('channel').setDescription('本 Guild 文字頻道').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))))
    .addSubcommand((s) => s.setName('snapshot').setDescription('授權者查看訊息原文與版本').addStringOption((o) => o.setName('message_id').setDescription('訊息 ID').setRequired(true)))
    .addSubcommandGroup((g) => g.setName('event').setDescription('事件政策').addSubcommand((s) => s.setName('set').setDescription('開關一種訊息事件')
      .addStringOption((o) => o.setName('type').setDescription('事件').setRequired(true).addChoices(...auditEventTypes.map((value) => ({ name: value, value }))))
      .addBooleanOption((o) => o.setName('enabled').setDescription('是否記錄').setRequired(true)))
      .addSubcommand((s) => s.setName('category').setDescription('開關一整類已實作事件')
        .addStringOption((o) => o.setName('category').setDescription('事件分類').setRequired(true).addChoices(...logCategories.filter((value) => value !== 'moderation').map((value) => ({ name: value, value }))))
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
    .addSubcommand((s) => s.setName('history').setDescription('查看本 Guild 最近健康樣本；PT-05 啟用才持續採樣'))
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
    .addSubcommand((s) => s.setName('import').setDescription('匯入本 Guild JSON 設定；不得擴大原文保存範圍')
      .addAttachmentOption((o) => o.setName('file').setDescription('config export 的 JSON，最多 64 KiB').setRequired(true))
      .addIntegerOption((o) => o.setName('revision').setDescription('目前設定版本').setRequired(true).setMinValue(0))
      .addBooleanOption((o) => o.setName('confirm').setDescription('明確確認替換目前設定').setRequired(true)))
    .addSubcommand((s) => s.setName('reset').setDescription('重設目前 Guild 設定；清空通知路由並關閉原文保存')
      .addIntegerOption((o) => o.setName('revision').setDescription('先用 config view 查閱目前設定版本').setRequired(true).setMinValue(0))
      .addBooleanOption((o) => o.setName('confirm').setDescription('確認重設設定；歷史紀錄與模組開關保留').setRequired(true)))
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
