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

Phase 1 沒有 HTTP Listener、不處理訊息原文、不上傳 R2。Bot 僅要求 Guilds Intent；其他 Intents 由後續模組明確增加。資料庫 unavailable 時拒絕啟動，絕不以 MemoryRepository 回退；MemoryRepository 只存在於 tests/helpers。

設定從 Repository 即時讀取，Guild 新增與撤銷無須重啟。每個設定更新使用 revision 條件，歷史與管理事件在同一個 PostgreSQL 交易保存。

模組開關保存在資料庫，程序內序列化同 Guild 的生命週期操作；PostgreSQL advisory lock 防止同資料庫兩個 Bot 同時啟動。模組個別初始化錯誤不阻止其他模組恢復。當連線失去程序鎖時 Bot 安全停止。

後續 API 必須沿用 Core Services 與相同授權，不新增第二套設定或管理邏輯。必要 Core 權限、錯誤邊界與復原管理不受業務模組開關停用。
