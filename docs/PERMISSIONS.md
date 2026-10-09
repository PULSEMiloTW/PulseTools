# 權限

Owner 由 DISCORD_OWNER_ID 指定，不由 Guild Administrator 推定。

| 角色 | Phase 1 能力 |
|---|---|
| L0 Owner | Allowlist、操作員、Lockdown、已授權 Guild 的設定與模組、診斷 |
| L1 授權管理員 | 僅其被授權 Guild 的設定、模組與狀態；同時需要 Discord Administrator |
| L2 Moderator | Phase 1 不提供管理設定權限；Phase 4 提供經授權管理員工具 |
| L3 Member | 沒有管理權限 |

除 Owner Allowlist / 安全復原指令外，Owner 也不能讀取未授權 Guild 的業務資料。授權管理員的內部角色必須與 Guild ID 一起查詢，修改 Guild ID 不能取得另一 Guild 資料。

Lockdown 暫停一般業務變更（Owner 的 Guild 設定與模組變更也暫停），保留 Owner 授權管理、安全模式解除與必要讀取診斷。所有管理回覆為 Ephemeral。

PT-06 / PT-07 開關只能控制可選介面，不能停用底層 PermissionManager、Allowlist、Lockdown 與必要復原指令。Phase 1 的 Owner / Module 管理指令即為必要管理介面，持續可用。

後續 Moderation 額外驗證原生權限、Bot 權限、角色階級、對象、時間與必要確認；目前沒有任何 kick / ban / purge 實作。
