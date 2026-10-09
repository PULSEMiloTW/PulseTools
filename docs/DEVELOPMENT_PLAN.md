# PulseTools 七階段開發計畫

依 Master Specification v1.1 與 PT-10 擴充需求實作。先通過目前階段驗收，再開始下一階段。各階段依序提交可驗證的原始碼，不能把離線測試宣稱為真實 Discord / R2 驗收。

| Phase | 工作 | 依賴 | 驗收 | 風險與處理 |
|---|---|---|---|---|
| 1 基礎 | Monorepo、Strict TypeScript、Discord Bot、PostgreSQL / Drizzle、Owner、多 Guild、模組介面、Embed | Node 24 LTS、專用 Bot、資料庫、兩個測試 Guild | Windows 啟動、真實 Discord 登入與 Slash Commands、兩 Guild 設定隔離、重啟持久化 | 不猜 Token；無連線資源時記為待驗收 |
| 2 Audit 基礎 | EventRouter、Snapshot、版本、事件去重、UTC 時間、Retention | Phase 1 通過 | 指定範圍保存、版本與刪除取回；缺失標 Unavailable；跨 Guild 隔離 | Message Content Intent 與隱私政策須明確啟用 |
| 3 成員及伺服器事件 | Member、Voice、Message、Role、Channel、通知路由與佇列 | Phase 2 通過 | 實際事件、統一 Embed、時間與路由、失敗重試 | 不推測踢除或操作者；限制重試與頻道权限 |
| 4 管理與監測 | Moderation Cases、Module Management、Health、Error Center、Lockdown | Phase 3 通過 | 權限與階級拒絕、案件持久化、模組開關、真實監測 | 破壞性實測需指定環境與同意 |
| 5 R2 | SDK、附件驗證、確認按鈕、持久狀態機、串流、驗證、連結、替代訊息、刪除 | Phase 4 通過、Bucket 憑證、下載方式 | PT-10 全部安全流程、多附件、去重、失敗保留原文 | 短期 URL 不可支援原文刪除；重啟不可重複上傳 |
| 6 Dashboard | Fastify、Discord OAuth2、React / Vite / Tailwind、所有管理頁 | Phase 5 通過、OAuth 憑證 | 真實 API、登入與 CSRF、每筆時間、Guild 隔離、瀏覽器驗證 | 預設 127.0.0.1；任何 API 重新授權 |
| 7 正式就緒 | Windows 安裝啟動、備份復原、Linux 遷移、整體測試及文件 | Phase 6 通過 | 全模組共同運作、重啟恢復、安全操作、部署驗證 | Service / 正式 migration / 對外公開需授權 |

## Phase 1 範圍與預計檔案

- apps/bot：啟動、診斷、Gateway、Slash Commands、Interaction 授權及錯誤邊界。
- packages/shared：環境變數、Guild 設定 Schema、型別、時間與錯誤代碼。
- packages/database：PostgreSQL schema、migration、Repository、交易與操作歷史。
- packages/core：GuildManager、ConfigurationManager、PermissionManager、ModuleManager。
- packages/modules：模組定義介面與十個模組目錄（尚未實作的標示 Unavailable）。
- packages/embed-system：Theme、長度限制、Footer、Timestamp、mention 防護。
- scripts：診斷、migration、明確的測試 Guild 指令註冊。
- tests：授權、隔離、設定、模組狀態、Embed、時間、啟動失敗與 PostgreSQL 整合測試。
- deploy/windows：安裝與啟動，不建立系統服務、不自動 migration。
- docs：需求原文、計畫、架構與 Phase 1 驗收狀態。

## 驗收紀錄

Phase 1 基礎驗收與 Phase 2 原文核心流程已有實際紀錄（PHASE_1_REPORT.md、PHASE_2_REPORT.md）。Phase 3 代表性真實事件與通知驗收通過，證據及未逐項實測的範圍見 PHASE_3_REPORT.md。Phase 4 已開始：先補齊設定重設確認與版本保護，其餘管理案件、健康監測與錯誤中心仍待實作。Phase 5–7 尚未開始，不將基礎版本宣稱為完整產品。
