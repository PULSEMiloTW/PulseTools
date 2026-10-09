import { z } from 'zod';
import type { ModuleDefinition } from './definition.js';
import type { ModuleId } from '../../shared/src/models.js';

const descriptions: [ModuleId, string, string, boolean][] = [
  ['PT-01', '進階事件紀錄', '事件、原文、版本與保存政策；Phase 2–3', false],
  ['PT-02', '成員通知', '加入與離開通知；Phase 3', false],
  ['PT-03', '設定中心', 'Phase 1 提供 Guild 設定讀取、時區與頻道設定；匯入與重設於 Phase 4', true],
  ['PT-04', '管理員工具', '案件與管理操作；Phase 4', false],
  ['PT-05', '系統監測', 'Phase 1 提供程序狀態；完整監測於 Phase 4', false],
  ['PT-06', 'Owner 存取控制', '必要 Core 權限保持啟用；此為可選管理介面', true],
  ['PT-07', '模組管理', '必要 Core 模組管理保持啟用；此為可選管理介面', true],
  ['PT-08', '錯誤追蹤', '持久錯誤中心；Phase 4', false],
  ['PT-09', '網頁管理後台', 'OAuth2 與 Dashboard；Phase 6', false],
  ['PT-10', '雲端檔案管理', 'R2 確認、上傳、連結與安全刪除；Phase 5', false],
];
export const moduleCatalog: ModuleDefinition[] = descriptions.map(([id, name, description, available]) => ({
  id, name, description, available, version: '0.1.0', dependencies: [],
  requiredPermissions: id === 'PT-03' ? ['Administrator'] : [], requiredGatewayIntents: ['Guilds'],
  configurationSchema: z.object({}).strict(),
  slashCommands: id === 'PT-03' ? ['config', 'pulse'] : id === 'PT-06' ? ['owner'] : id === 'PT-07' ? ['module'] : [],
  eventHandlers: {},
  // Phase 1 管理介面使用 Core Services，沒有個別 Gateway Listener；生命週期仍需做資料庫檢查。
  async initialize(context) { await context.repository.health(); },
  async shutdown() {},
  async health(context) { return available && await context.repository.health() ? 'Running' : 'Unavailable'; },
}));
