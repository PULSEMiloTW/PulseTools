# Windows 本機設定

## 1. 必要資源

- Node.js 24 LTS（本機開發使用 v24.13.0）。
- PostgreSQL 17 或以上，PulseTools 專用資料庫與執行帳號。
- PulseTools 專用 Discord Application / Bot，Owner Discord ID。
- 兩個明確指定的測試 Guild，Bot 已加入，具 View Channel、Send Messages、Embed Links 權限。

請勿借用 PulseCore Token 或修改其服務。Phase 1 只要求 Guilds Intent；尚不需要 Message Content 與 Guild Members privileged intents。

資料庫可以完全在本機運作，不需要線上供應商；初次安裝與 pgAdmin 設定見 [LOCAL_DATABASE.md](LOCAL_DATABASE.md)。

## 2. 安裝與環境

從專案根目錄執行 deploy/windows/install.ps1。此腳本僅安裝套件、建立不存在的 .env、檢查及 build，不建立 Windows Service、不 migration、不啟動 Bot。

在本機 .env 填入：

- DISCORD_BOT_TOKEN、DISCORD_CLIENT_ID、DISCORD_OWNER_ID。
- DATABASE_URL：專用 PulseTools 資料庫連線 URI（PostgreSQL URL）。
- DISCORD_COMMAND_GUILD_IDS：兩個測試 Guild ID，逗號分隔。
- TEST_DATABASE_URL：另建專用空測試資料庫，名稱含 test，不能與 DATABASE_URL 相同。

機密不貼到聊天、不提交 Git。不將現有正式資料庫作為測試資料庫。PostgreSQL 安裝、角色與資料庫建立需依你的系統管理流程完成；本專案不自動安裝資料庫服務。

OAuth2、SESSION_SECRET、R2 憑證為後續階段選用，Phase 1 可留空；API_HOST 預設 127.0.0.1。Phase 1 沒有 Dashboard Listener。

## 3. 專用環境初始化

確認目標是 PulseTools 專用、已授權的測試資料庫及 Discord Application 後：

```powershell
npm run db:migrate
npm run doctor
npm run test:database
npm run commands:register
powershell -File deploy/windows/start.ps1
```

commands:register 是真實 Discord 指令寫入，僅影響 PulseTools Application 與指定 Guild。Bot 本身不自動註冊；每次新版本有命令變更時再手動註冊。

日常啟動改用根目錄 `00_啟動PulseTools.cmd`；按 Ctrl+C 停止，停止後再雙擊即可重啟。依名稱升冪排序時可讓它靠近最上方。啟動時會編譯最新原始碼，不執行 migration，也不自動重啟。Bot 的手動啟停由使用者操作，Codex 不代為重啟。

## 4. Phase 1 真實驗收

1. 確認控制台出現 Discord 已連線，Application ID 一致及實際 Guild 數。
2. Owner 分別對兩個測試 Guild 執行 /owner guild allow。
3. 在各 Guild 執行 /pulse setup、/module enable id:PT-03、/config view。
4. Guild A 設為 UTC，Guild B 保持 Asia/Taipei；讀取時應隔離。
5. 以非 Owner 測試拒絕，再由 Owner 指定其為 Guild A 的 admin；只有同時具 Discord Administrator 才可操作，Guild B 應拒絕。
6. 測試 Lockdown 拒絕設定變更，Owner 可解除。
7. Ctrl+C 停止 Bot，重新啟動；設定與模組狀態應恢復且沒有第二個 Bot。
8. 保存不含 Secret 的實測結果，再更新 Phase 1 驗收報告。

本階段不需踢人、Ban、刪除訊息、R2 實際上傳。需要此類操作時另指定測試目標及同意。
