# Phase 1 開發與驗收報告

日期：2026/10/09（Asia/Taipei）。最新狀態：**Phase 1 基礎驗收通過**。以下保留各次檢查與阻礙的歷史紀錄，以最後的驗收結果為準；尚未交付完整十模組產品。

## 已實作

- npm Workspaces Monorepo、Strict TypeScript、Node 24 LTS。
- discord.js Bot：Guilds Intent、Gateway 登入、官方 Watching Presence、重連後恢復、Ephemeral 指令、錯誤邊界、Ctrl+C 資源清理。
- PostgreSQL / Drizzle：六張基礎表、Migration、交易、設定 revision 與歷史。
- Guild Allowlist、Owner ID、Guild 內部角色加原生權限、Lockdown。
- 共用 Guild / Permission / Configuration / Module Services。
- 十個模組目錄、狀態、生命週期、去重初始化與同 Guild 序列操作；後續模組標 Unavailable。
- 統一 Embed Theme、Footer、native timestamp、長度與 mention 防護。
- UTC 時間、Asia/Taipei 顯示與來源標記。
- Windows 安裝啟動腳本、doctor、明確測試 Guild 指令註冊、七階段計畫。
- CI 定義：Windows 離線檢查、Linux 隔離 PostgreSQL 整合測試；尚未推送或執行 CI。

## 新增或修改檔案

| 範圍 | 主要檔案 |
|---|---|
| 根目錄 | package.json / lock、tsconfig、drizzle.config.ts、.gitignore、.env.example、AGENTS.md、README |
| apps/bot | commands.ts、interaction-handler.ts、main.ts |
| apps/api / dashboard | Workspace 邊界與明確的後續階段說明，尚未實作功能 |
| packages/shared | models、environment、errors、timestamp |
| packages/database | connection、repository、schema、Drizzle SQL / metadata |
| packages/core | Guild、Permission、Configuration、Module Manager 與組裝 |
| packages/modules | ModuleDefinition 與十個模組 catalog |
| packages/embed-system | 統一 Embed Builder |
| scripts / deploy | doctor、migrate、register-commands、Windows install / start |
| tests | foundation、shared、interactions、database.integration、MemoryRepository |
| docs / .github | 需求原文、PT-10、計畫、架構與操作文件、CI workflow |

## 實際檢查

| 檢查 | 結果 |
|---|---|
| npm run typecheck | 通過 |
| npm test | 36 / 36 離線測試通過 |
| npm run build | 通過 |
| npm run db:generate | 產生六張表的 SQL Migration；不等於已執行 migration |
| npm audit（全部依賴） | 0 個已知漏洞 |
| npm audit --omit=dev | 0 個已知漏洞 |
| Windows PowerShell 腳本解析 | install.ps1 / start.ps1 通過；不等於實際部署 |
| 本機文件連結、diff、機密檢查 | 通過；測試中的固定字串明確為離線輸入，.env 已確認忽略 |
| npm run doctor | 安全拒絕：必要環境變數尚未填入，未建立連線 |
| node dist/apps/bot/src/main.js | 安全拒絕缺少必要設定，沒有登入 Discord |
| npm run test:database | 環境阻礙：未設定 TEST_DATABASE_URL，0 項實際 DB 測試執行；不算通過 |

## 尚未完成與階段閘門

- 真實 PostgreSQL Migration 與兩 Guild 持久化驗收。
- 專用 Bot 登入、Slash Commands 互動、原生權限、Presence、持續程序與重啟證據。
- 其他 Phase 2～7 模組、Dashboard、R2、備份復原及正式部署尚未開始。
- 已詢問使用者在本機填入 .env，並確認專用測試 DB / Guild / Application 初始化與實測授權。
- 未通過 Phase 1 真實驗收前不進入 Phase 2，且依使用者提供的 Git 檢查規則，暫不 commit / push。

目前分支 main，目標 origin/main（PULSEMiloTW/PulseTools），基底 commit 936aeac。所有開發內容保留於本機，沒有修改 PulseCore 或正式服務。

## 本機資料庫與手動啟動補充（2026/10/09）

使用者選擇本機 PostgreSQL，並要求由自己手動管理 Bot。已新增根目錄 `00_啟動PulseTools.cmd` 與 LOCAL_DATABASE.md；啟動腳本先診斷與 build，再直接執行 Node，Ctrl+C 停止後重新雙擊即可重啟。

Windows PowerShell 5.1 腳本語法與本機文件連結檢查通過；Windows 腳本以 UTF-8 BOM 保存，避免繁體中文在 PowerShell 5.1 誤讀。本次未執行啟動檔、未啟停 Bot、未改寫使用者已填好的 .env、未安裝或修改資料庫服務。使用者仍需完成本機 PostgreSQL 安裝與專用資料庫初始化，再進行 Phase 1 真實驗收。

## Supabase 初始化嘗試（2026/10/09）

使用者改採 Supabase 專用專案，已填好連線並授權建立資料表。以完整 TLS 驗證測試 Session pooler 時收到 SELF_SIGNED_CERT_IN_CHAIN，因此沒有執行 migration 或建立資料表。

新增 DATABASE_SSL_CA_PATH、遠端 TLS 強制驗證及 Supabase 設定文件；拒絕 Transaction pooler，避免持久程序鎖失效。40 項離線測試、typecheck、build 通過。等待使用者從 Dashboard 下載 CA 憑證至本機後繼續已授權的初始化，不重複要求授權；不啟動或重啟 Bot。真實 DB 驗收仍未通過，因此未 commit / push。

## Supabase 初始化結果（2026/10/09）

使用者已放好 CA 憑證。原檔名為 abase-ca.crt，經 X509 驗證後保留原檔，複製至設定使用的 supabase-ca.crt；兩檔皆不納入 Git。

Session pooler 連線成功，TLS 加密與憑證驗證皆為 true；初始化前 public / drizzle 表數為 0。已依使用者授權執行 npm run db:migrate，建立六張基礎表與 Drizzle Migration 歷史。npm run doctor 通過，已授權 Guild 數為 0。

這是連線、Schema 與初始化驗證，不等於兩 Guild 真實持久化整合測試或 Discord 上線驗收。未註冊 Discord 指令、未啟動或重啟 Bot；後續啟停仍由使用者手動操作。Phase 1 完整驗收仍待完成，commit / push 暫停。

## 指令註冊診斷（2026/10/09）

Token 可取得目前 Application，且 Application ID 相符；兩個已設定 Guild 均回傳 HTTP 404 / Discord 10004（Unknown Guild）。此 Bot 可查到一個已加入 Guild，與設定的目標均不同。未猜測或改寫目標 Guild，等待使用者確認正確伺服器 ID 及 Bot 安裝。

註冊腳本新增全部目標的唯讀預檢與安全錯誤說明。44 項離線測試、typecheck、build 通過；已用真實環境確認錯誤能在預檢階段指出原因，沒有寫入指令。Bot 未啟動或重啟。真實註冊仍受目標設定阻礙，尚未 commit / push。

## 指令註冊完成（2026/10/09）

使用者確認目標為歡樂Ma屋與 Pulse Studio HQ。已只修改本機 .env 的 DISCORD_COMMAND_GUILD_IDS；兩個目標預檢通過，各註冊五個頂層指令 pulse、system、owner、config、module。Bot 未啟動或重啟。Discord 指令互動、Guild 業務授權與 Phase 1 完整驗收仍由後續手動啟動後確認。

## Windows PowerShell 版本檢查修正（2026/10/09）

使用者手動啟動發現 Windows PowerShell 5.1 會移除 node -p JavaScript 參數內的雙引號，造成 split(.) 語法錯誤。start.ps1 與 install.ps1 改用 node --version，再由 PowerShell 檢查 ^v24\.，避免傳遞 JavaScript 引號。Windows PowerShell 5.1 實測正確辨識 v24.13.0；安裝腳本也明確使用 npm.cmd，避免執行政策攔截 npm.ps1。Bot 未由 Codex 啟動或重啟，完整 Phase 1 驗收仍待使用者實測。

## 手動指令與資料回讀（2026/10/09）

使用者回報兩 Guild 已完成 pulse setup、module enable PT-03 與 config view。經另一個獨立 PostgreSQL 連線、使用正式 Core / Repository 回讀，歡樂Ma屋與 Pulse Studio HQ 均 authorized=true、PT-03 enabled=true / Running；兩 Guild 模組查詢只回傳各自 guild_id。原文保存均為 false。Bot 的資料庫程序鎖確實已由運作程序持有，Codex 未啟停 Bot。

目前兩 Guild 設定 revision 都為 0、時區都是 Asia/Taipei；這證明初始化與模組狀態已保存，尚不足證明不同設定更新後的隔離與 Bot 重啟恢復。最後仍需使用者在一個 Guild 修改時區並自行停止 / 重新啟動後確認結果，才能完成對應真實驗收；暫不標示 Phase 1 完整通過或進入 Phase 2。

## Phase 1 最終驗收（2026/10/09）

使用者依要求修改歡樂Ma屋時區、手動停止及重新啟動，再提供兩 Guild 的 config view 結果。HQ 為 Asia/Taipei / revision 0，歡樂Ma屋為 UTC / revision 1；獨立資料庫連線回讀亦一致，兩 Guild PT-03 均為 Running。真實指令與重啟驗收證據來自使用者操作，Codex 沒有啟停 Bot。

新增 Supabase 隔離 Schema 自動整合測試，六項全部通過：Migration、兩 Guild 持久化與重開連線、競爭交易、操作員與模組恢復、UTC、撤銷授權後保留資料。測試只在本次新建的唯一 Schema 內執行，結束後已清除，正式 Guild 設定保留。加上 44 項離線測試、Strict TypeScript、build，Phase 1 基礎驗收通過。

尚未驗收的 Phase 2～7 功能仍未開放；真實 Moderation、R2、Dashboard、完整 PT-05 / PT-08 與備份復原不是本次完成範圍。接續 Phase 2 前保持原文保存預設關閉，不自動啟用新的 privileged intents 或重新啟動 Bot。
