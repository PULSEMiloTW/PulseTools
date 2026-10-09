# 系統架構

Monorepo + Modular Monolith，以 Node.js 24 LTS 與 Strict TypeScript 執行。

| 目錄 | 責任與目前狀態 |
|---|---|
| apps/bot | Gateway、Interaction、Presence；Phase 1 已實作 |
| apps/api | Fastify / OAuth2；Phase 6 尚未開始 |
| apps/dashboard | React / Vite / Tailwind；Phase 6 尚未開始 |
| packages/core | Permission、Guild、Configuration、Module 共用業務服務 |
| packages/database | PostgreSQL、Drizzle Schema、Repository、Migration |
| packages/shared | 輸入驗證、型別、UTC / 時區、錯誤代碼 |
| packages/modules | 模組介面與目錄；每個模組生命週期、依賴、Intents、權限、設定 Schema |
| packages/embed-system | 統一品牌、色彩、長度限制與 mention 防護 |

目前沒有 HTTP Listener；PT-10 由明確確認觸發 R2 上傳。Phase 2 透過明確的 DISCORD_MESSAGE_EVENTS_ENABLED 開啟 GuildMessages / MessageContent Intents，接收原始 Gateway Dispatch → 有界 EventRouter → PostgresAuditRepository 交易，AuditService 統一驗證原文查看者。未開啟旗標時只要求 Guilds。資料庫 unavailable 時拒絕啟動，絕不以 MemoryRepository 回退；MemoryRepository 只存在於 tests/helpers。

設定從 Repository 即時讀取，Guild 新增與撤銷無須重啟。每個設定更新使用 revision 條件，歷史與管理事件在同一個 PostgreSQL 交易保存。

模組開關保存在資料庫，程序內序列化同 Guild 的生命週期操作；PostgreSQL advisory lock 防止同資料庫兩個 Bot 同時啟動。模組個別初始化錯誤不阻止其他模組恢復。當連線失去程序鎖時 Bot 安全停止。

後續 API 必須沿用 Core Services 與相同授權，不新增第二套設定或管理邏輯。必要 Core 權限、錯誤邊界與復原管理不受業務模組開關停用。

Phase 3：Discord 型別事件 → 每 Guild EventRouter → PostgresServerEventRepository → 同交易 Notification Outbox → NotificationWorker → Discord Embed。訊息沿用 Phase 2 Repository 並在同一交易排入不含原文的通知。Gateway context 使用 session 雜湊與 sequence 防重；PT-02 獨立生命週期。Worker 在就緒時即時喚醒並每兩秒處理待送工作；使用者啟用模組及設定頻道後才會發送。

Phase 4：ModerationService 統一內部授權與 Lockdown，DiscordModerationTransport 取得最新成員、原生權限、Bot 權限與階級；Repository 先保存案件再執行外部操作，結果與安全通知同交易保存。程序中斷後 Pending 恢復 Unknown，不重做處分。HealthMonitor 測量真實程序與 API／DB，每分鐘只為已啟用 PT-05 的授權 Guild 保存樣本。Core 錯誤邊界透過 MonitoringRepository 保存安全分類與五分鐘聚合；ErrorService 統一查閱／確認及全域 Owner 權限。

Phase 5：MessageCreate → R2Service → PostgreSQL 原子請求 claim → R2StorageService（SDK／限時暫存串流／內容探測／Head 驗證）→ DiscordR2Transport（結果與可選刪除）。請求、物件、事件及 Guild 政策獨立持久化；重啟不自動重做外部寫入。私人一小時簽署連結支援上傳者重新取得，原訊息保留；詳細流程見 R2_STORAGE.md。
