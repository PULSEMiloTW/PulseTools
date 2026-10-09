# 部署界線

Phase 1 僅提供本機手動啟動。尚未建立 Windows Service、排程工作、自動啟動、備份復原或公開服務；這些於 Phase 7 實作及驗證。

安裝與初始化完成後，使用根目錄 `00_啟動PulseTools.cmd` 啟動；它呼叫 deploy/windows/start.ps1，檢查設定並編譯最新程式。Ctrl+C 正常關閉 Gateway、模組與 DB Pool；再次雙擊即可手動重啟。資料庫 migration 與指令註冊是獨立操作，不藏在啟動腳本中。

Bot 啟動、停止、重啟由使用者手動控制，Codex 不代為操作；沒有自動重啟迴圈。PostgreSQL 可以使用本機安裝，資料庫服務與 Bot 的生命週期分開。

任何正式 migration、服務重啟、Tunnel 或公開網路管理端點，必須另取得明確授權。Git push 不代表部署。

Linux 同樣使用 Node 24、PostgreSQL 與 .env，從專案根目錄執行 npm ci、npm run check、npm start；systemd 與備份策略留待 Phase 7。不得將機密或 Windows runtime 檔案複製進 Git。
