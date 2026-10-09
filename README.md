# PulseTools

Powered by Pulse Studio

私人、多 Guild 的 Discord Management & Automation System，以 TypeScript Modular Monolith 開發。

Phase 1–3 已取得代表性實際驗收紀錄。**Phase 4 管理案件、健康監測與錯誤中心已實作，使用者已回報手動驗收通過**；範圍與步驟見 [Phase 4 報告](docs/PHASE_4_REPORT.md)。PT-01～10 的完整產品仍在依階段開發，PT-10 R2 已實作，需手動啟用與真實上傳驗收，詳見 [R2 設定](docs/R2_STORAGE.md)；Dashboard 尚未開放。

## 快速開始（Windows）

需要 Node.js 24 LTS、PostgreSQL 17 或以上及 PulseTools 專用 Discord Application。從專案根目錄操作：

PostgreSQL 可選擇 [Supabase](docs/SUPABASE_SETUP.md) 或 [本機資料庫](docs/LOCAL_DATABASE.md)。目前已驗證的部署使用 Supabase Session pooler，Bot 仍由使用者在 Windows 本機手動管理。

```powershell
powershell -File deploy/windows/install.ps1
```

在本機 `.env` 填入必要設定後，依 [Windows 設定](docs/WINDOWS_SETUP.md) 確認專用資料庫與測試 Guild，再執行：

```powershell
npm run db:migrate
npm run doctor
npm run commands:register
npm start
```

Bot 不會自動 migration、不會自動註冊指令、不會授權所有已加入的 Guild。Owner 使用 `/owner guild allow` 明確授權，再使用 `/module enable id:PT-03` 啟用設定介面。只登入 Discord 不代表業務功能已啟用。

設定完成後，日常使用只要雙擊根目錄 **00_啟動PulseTools.cmd**。它會檢查設定並編譯最新程式，再於控制台啟動 Bot。按 **Ctrl+C** 停止，停止後再次雙擊即可重啟；不會自動重啟。檔案總管依名稱升冪排序時，`00_` 前綴可讓啟動檔靠近最上方。

## 驗證

```powershell
npm run check
npm run test:database
npm audit --omit=dev
```

`test:database` 必須另設定專用、空白且名稱包含 `test` 的 `TEST_DATABASE_URL`，不得與 Bot 資料庫相同。測試建立資料表與明確測試資料，不會清除既有資料；再次測試需另一個空測試資料庫。

Supabase 可改執行 `npm run test:database:sandbox`：在 DATABASE_URL 的資料庫建立唯一的隔離測試 Schema，無 public fallback，測試後只清除本次新建 Schema。此模式需要 CREATE SCHEMA 權限，不修改正式 Guild 設定。

## 文件

- [需求原文](docs/REQUIREMENTS.md) 與 [PT-10 擴充](docs/PT10_REQUIREMENTS.md)
- [七階段計畫](docs/DEVELOPMENT_PLAN.md) 與 [Phase 1 驗收報告](docs/PHASE_1_REPORT.md)
- [架構](docs/ARCHITECTURE.md)、[資料庫](docs/DATABASE.md)、[模組](docs/MODULES.md)
- [權限](docs/PERMISSIONS.md)、[指令](docs/COMMANDS.md)、[Embed](docs/EMBED_DESIGN.md)
- [Windows 設定](docs/WINDOWS_SETUP.md)、[部署](docs/DEPLOYMENT.md)、[安全](docs/SECURITY.md)、[測試](docs/TESTING.md)

完整 Dashboard、備份復原、R2 及其他模組文件於相應階段完成並驗收。PulseCore 僅提供視覺參考；事件 Embed 顏色以 Master Specification v1.1 為準。
