import { z } from 'zod';
import type { ModuleDefinition } from './definition.js';
import type { ModuleId } from '../../shared/src/models.js';

const descriptions: [ModuleId, string, string, boolean][] = [
  ['PT-01', '進階事件紀錄', '訊息、成員、語音、角色、頻道及伺服器事件 Audit 與通知；管理操作於 Phase 4', true],
  ['PT-02', '成員通知', '獨立加入／離開頻道、歡迎文字、頭像及成員總數', true],
  ['PT-03', '設定中心', 'Guild 設定讀取、匯出、時區、路由與確認重設', true],
  ['PT-04', '管理員工具', '經確認的處分、持久案件、關聯解除與備註', true],
  ['PT-05', '系統監測', '實際程序、REST、Gateway、DB、CPU、記憶體與持久健康樣本', true],
  ['PT-06', 'Owner 存取控制', '必要 Core 權限保持啟用；此為可選管理介面', true],
  ['PT-07', '模組管理', '必要 Core 模組管理保持啟用；此為可選管理介面', true],
  ['PT-08', '錯誤追蹤', '持久錯誤分類、五分鐘聚合、通知與確認', true],
  ['PT-09', '網頁管理後台', 'OAuth2 與 Dashboard；Phase 6', false],
  ['PT-10', '雲端檔案管理', 'R2 確認、附件驗證、持久上傳與下載連結', true],
];
export const moduleCatalog: ModuleDefinition[] = descriptions.map(([id, name, description, available]) => ({
  id, name, description, available, version: '0.1.0', dependencies: [],
  requiredPermissions: id === 'PT-03' ? ['Administrator'] : id === 'PT-04' ? ['ModerateMembers', 'KickMembers', 'BanMembers', 'ManageMessages（依操作逐項檢查）'] : ['PT-01','PT-02','PT-08','PT-10'].includes(id) ? ['ViewChannel', 'SendMessages', 'EmbedLinks'] : [], requiredGatewayIntents: id === 'PT-10' ? ['Guilds','GuildMessages','MessageContent'] : id === 'PT-01' ? ['Guilds', 'GuildMessages', 'MessageContent', 'GuildVoiceStates', 'GuildInvites', 'GuildMembers（成員事件另開旗標）'] : id === 'PT-02' ? ['Guilds', 'GuildMembers'] : ['Guilds'],
  configurationSchema: z.object({}).strict(),
  slashCommands: id === 'PT-01' ? ['logs'] : id === 'PT-02' ? ['welcome'] : id === 'PT-03' ? ['config', 'pulse'] : id === 'PT-04' ? ['mod'] : id === 'PT-05' ? ['system'] : id === 'PT-06' ? ['owner'] : id === 'PT-07' ? ['module'] : id === 'PT-08' ? ['error'] : id === 'PT-10' ? ['r2'] : [],
  eventHandlers: {},
  // 共用 Gateway Router 僅綁定一次；每 Guild 模組開關控制接收與發送，不重複掛載 Listener。
  async initialize(context) { if (id === 'PT-10') await context.repository.r2Health(); else if (id === 'PT-01' || id === 'PT-02') await context.repository.auditHealth(); else if (['PT-04','PT-05','PT-08'].includes(id)) await context.repository.managementHealth(); else await context.repository.health(); },
  async shutdown() {},
  async health(context) { return available && await (id === 'PT-10' ? context.repository.r2Health() : ['PT-04','PT-05','PT-08'].includes(id) ? context.repository.managementHealth() : id === 'PT-01' || id === 'PT-02' ? context.repository.auditHealth() : context.repository.health()) ? 'Running' : 'Unavailable'; },
}));
