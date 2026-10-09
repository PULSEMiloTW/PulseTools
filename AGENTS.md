# PulseTools 開發規範

- 依 docs/REQUIREMENTS.md 與 docs/PT10_REQUIREMENTS.md 實作；階段計畫見 docs/DEVELOPMENT_PLAN.md。
- 採最小必要變更，針對性搜尋，不擅自新增大型功能或破壞其他模組。
- 機密只存於 .env；禁止提交 Token、Secret、憑證及執行資料。
- 資料庫異動必須更新 Drizzle Schema 並提供 Migration；不得在 Bot 啟動時自動執行 Migration。
- 所有 Guild 業務資料須隔離；授權必須由 Core Services 驗證。
- Discord 回覆使用統一 Embed Design System；安全錯誤採 Ephemeral。
- 時間使用 UTC 儲存，預設 Asia/Taipei 顯示，不推測未知事件時間。
- 保持 Windows / Linux 相容；程式修改執行相關測試、typecheck 與 build。
- 不使用假資料冒充真實資料；尚未實作的模組明確標示 Unavailable。
- 真實 Discord 管理操作、R2 上傳、公開服務及 Windows Service 安裝需另取得明確測試目標與同意。
- 階段驗收失敗先修正，不跳過驗收進入下一階段。保留未完成驗收的明確紀錄。
- Bot 的啟動、停止、重啟由使用者透過根目錄啟動檔手動操作；除非之後取得明確授權，Codex 不代為啟停或重啟 Bot。
