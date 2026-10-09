# 模組狀態

每個模組定義包含 ID、名稱、版本、描述、可用狀態、依賴、必要權限、必要 Intents、設定 Schema、命令、事件處理及 initialize / shutdown / health。

Phase 1–3 提供 Core、訊息原文及成員／伺服器即時事件。十個模組目錄不等於十個完整模組已完成：

| ID | 現況 |
|---|---|
| PT-01 | 訊息、成員、語音、角色、頻道、Guild、邀請 Audit 及分類通知；需對應 Intents／事件開關；管理案件 Phase 4 |
| PT-02 | 加入／離開獨立頻道、模板、頭像、人數、預覽及明確測試；需 Server Members Intent |
| PT-03 | 可啟用基礎設定介面；匯入、確認重設等尚未實作 |
| PT-04 | Unavailable；Phase 4 |
| PT-05 | Unavailable；目前只有 Core 程序資訊指令，完整監測 Phase 4 |
| PT-06 | Core Owner 授權與復原已提供；可選管理介面目錄可切換 |
| PT-07 | Core 模組管理已提供；生命週期及持久狀態可驗證 |
| PT-08 | Unavailable；目前僅安全錯誤邊界，完整追蹤 Phase 4 |
| PT-09 | Unavailable；Phase 6 |
| PT-10 | Unavailable；Phase 5 |

各 Guild 預設不啟用任何業務模組。Unavailable 模組不能啟用。Disabled 保留設定與歷史，Error 表示生命週期失敗。啟動恢復已存狀態，授權撤銷後新業務操作立即拒絕。
