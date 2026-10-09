# 模組狀態

每個模組定義包含 ID、名稱、版本、描述、可用狀態、依賴、必要權限、必要 Intents、設定 Schema、命令、事件處理及 initialize / shutdown / health。

Phase 1–4 提供 Core、訊息原文、即時事件、管理案件與監測。十個模組目錄不等於十個完整模組已完成：

| ID | 現況 |
|---|---|
| PT-01 | 訊息、成員、語音、角色、頻道、Guild、邀請 Audit 及分類通知；需對應 Intents／事件開關；管理案件 Phase 4 |
| PT-02 | 加入／離開獨立頻道、模板、頭像、人數、預覽及明確測試；需 Server Members Intent |
| PT-03 | 設定、匯出、受限 JSON 匯入及確認／版本保護重設 |
| PT-04 | 經確認的管理操作、案件、關聯解除、歷史、備註與獨立通知開關；使用者手動驗收通過 |
| PT-05 | 程序／Gateway／REST／DB／CPU／記憶體與每分鐘健康樣本；使用者手動驗收通過 |
| PT-06 | Core Owner 授權與復原已提供；可選管理介面目錄可切換 |
| PT-07 | Core 模組管理已提供；生命週期及持久狀態可驗證 |
| PT-08 | 安全持久錯誤、五分鐘聚合、通知、統計與確認；不保存原始 Stack Trace，使用者手動驗收通過 |
| PT-09 | Unavailable；Phase 6 |
| PT-10 | 已實作確認上傳、私人／公開連結、檔案歷史與安全刪除；需 R2 憑證及 Message Content Intent，真實上傳待驗收 |

各 Guild 預設不啟用任何業務模組。Unavailable 模組不能啟用。Disabled 保留設定與歷史，Error 表示生命週期失敗。啟動恢復已存狀態，授權撤銷後新業務操作立即拒絕。
