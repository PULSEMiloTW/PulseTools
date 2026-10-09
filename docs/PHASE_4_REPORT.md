# Phase 4 — 管理案件與系統監測

2026-10-09：原始碼、自動測試與使用者手動驗收通過。可以進入 Phase 5；R2 尚未實作或開放。

## 已實作

- PT-04：`/mod warn`、timeout、untimeout、kick、ban、unban、purge、history、detail、note、notifications。每次操作需 reason 與 confirm=true；所有指令回覆 Ephemeral。
- Warn 保存警告案件及設定的案件通知，不私訊目標。Ban 只接受目前 Guild 成員且不刪除訊息；Unban 接受已封鎖 ID。解除禁言／封鎖必須提供同 Guild、同對象、成功的原始對應案件 UUID，建立新案件而不覆寫原始案件。不接受以此流程解除外部建立且沒有 PulseTools 案件的處分。
- Purge 僅針對目前 Guild 頻道最新 1–100 筆，跳過釘選及兩週前訊息；記錄實際清理數量，不以要求數量冒充結果。SDK 單筆刪除與批次刪除均不加入本系統的原文保存。
- 案件保存 Case ID、Guild、對象、管理者、操作、原因、狀態、時間、關聯案件及安全錯誤碼。備註追加保存，不修改原始原因。
- 案件通知經既有持久 Outbox 發往 moderation 路由，只包含 ID、操作、結果與清理數；原因及備註僅供私密案件查閱。`/mod notifications` 可按操作獨立切換通知，停用通知不停止案件保存。
- L2 Moderator 可存取管理案件，無法管理 Guild 設定；需相同 Guild 內部 admin／moderator 授權，以及目前 Discord 原生管理權限。執行前另按操作檢查原生及 Bot 權限、目前頻道權限與角色階級；PulseTools Owner 不繞過 Discord 原生操作限制。
- 不處分本人、Bot、其他 Bot 或 Guild Owner。使用者及 Bot 的最高角色必須高於目標；Guild Owner 可略過自身角色順位，Bot 階級仍需通過。禁言及解除禁言拒絕 Administrator 目標。禁言上限 28 天。
- 已有 Owner Lockdown 擋下新處分、備註、設定與通知測試；保留讀取、Owner 復原及錯誤確認。
- PT-05：`/system status`、ping、uptime、diagnostics、modules、history。實際測量 Gateway ping、REST `/users/@me` 往返、DB 往返、程序 CPU（單核心基準，可能超過 100%）、RSS／Heap、程序開始時間與 uptime、真實 Guild 數、目前 Guild 模組數、錯誤次數及通知狀態。API／DB 不可用顯示 Degraded；無法取得的數值標示 Unavailable。
- PT-05 啟用的授權 Guild 每分鐘保存健康樣本，保存 30 天；模組關閉後停止新採樣但保留有效歷史。Core 必要診斷仍可使用。健康 poll 不重入；`/module health` 執行目前 Repository 健康探測。
- PT-08：`/error list`、detail、stats、acknowledge。指令、權限、Gateway、Audit 寫入、通知與管理 API 失敗有持久安全紀錄；相同 scope／module／type／code 以 UTC 五分鐘窗合併，每組最多一筆通知。確認後若同窗再次發生，狀態回到 Open，累計次數保留。
- 錯誤只保存固定代碼與系統產生的摘要，不保存第三方例外原文、URL、Request 或原始 Stack Trace；detail 因此也不提供原始 Stack Trace。錯誤分類有未來 Dashboard／R2 類型，但本階段不假造那些模組的實際錯誤。
- `/error ... global:true` 僅 Owner 可看全域診斷；未授權 Guild 的拒絕紀錄只保留安全全域類別，隱去 Guild ID。PT-08 控制 Guild 錯誤查閱與通知；必要 Core 安全錯誤保存不因關閉業務介面而停止。
- PT-03：確認重設與版本保護、JSON 匯入。匯入最多 64 KiB，限 Discord HTTPS 附件 URL、禁止 redirect、五秒下載期限、串流上限、嚴格 Schema、目前 Guild 頻道檢查及預期版本；不接受 Secret 欄位，也不允許繞過 capture 隱私告知來擴大原文捕捉。

## 結果一致性與資料庫

- 新增 moderation_cases、moderation_notes、error_records、health_samples，均啟用 RLS，無匿名存取政策。
- Migration 0004／0005 只新增表與索引，不改既有 Guild 設定。0004 審查時將自關聯案件所需的唯一索引移至 FK 之前，避免生成 SQL 的建立順序錯誤；隔離 PostgreSQL 已執行同一份 migration。
- 處分先存 Pending，再驗證最新權限、執行 Discord，最後寫 Succeeded／Failed／Unknown。相同 Guild／Interaction ID 不重複執行；結果與通知同交易保存。DB 寫回失敗保留 Pending，手動重啟後改為 Unknown，不盲目重做。
- Discord Client 的 REST retries=0，避免 SDK 在 500／timeout 時自行重做處分；官方 429 排程仍由 SDK 處理。一般通知的有界重試繼續由 Outbox Worker 控制。
- Pending 不代表尚未執行；Unknown 需人工核對 Discord 狀態。不同 Interaction 是不同管理請求，不宣稱全系統 exactly-once。
- 停止時等待已受理指令、Router、通知、健康與背景錯誤寫入；保留既有十秒停止上限，程序被中止的案件依上述 Unknown 流程處理。
- 本階段只對 PulseTools 自己執行的案件保存已知管理者，不以成員離開事件推測踢除／封鎖，也未實作外部 Discord Audit Log 的操作者關聯。
- 案件與錯誤保留歷史，不隨模組停用刪除；健康樣本及通知各自按期限清理。完整歷史政策與備份復原仍屬後續正式就緒工作。

## 驗證

- Strict TypeScript、83 項離線測試與 build 通過，包含 Purge 篩選、案件選單權限／對象／UUID／時間／顯示上限及選定對象後的明細與備註核對。
- 27 項 PostgreSQL 隔離 Schema 整合測試通過，涵蓋所有 migrations、四張表 RLS、並行案件去重、持久與關聯案件、跨 Guild 備註、Lockdown、Unknown 恢復、管理通知開關與安全 payload、並行錯誤聚合／單次通知／重新開啟、健康採樣及期限清理。
- 所有管理 transport 測試均為 mock／純驗證；未對真實 Discord 成員處分、清理訊息、發送測試通知或重啟 Bot。CI 執行結果未檢查，不宣稱 CI 通過。
- 專用 Supabase 已套用 0004／0005，四張新增表及 RLS 已唯讀核對，doctor 通過。九個頂層指令已更新至歡樂Ma屋（1317365273573064714）及 Pulse Studio HQ（1557255271758303252）。未修改 .env、既有 Guild 路由或模組開關；新版程序仍待使用者手動重啟。

## 手動啟用與驗收

目前實際進度：兩 Guild PT-04／PT-05／PT-08 均為 Running，健康樣本已持續保存。Pulse Studio HQ 有兩筆成功 Warn、兩筆備註，以及一筆成功 Timeout 和一筆成功 Untimeout。使用者已手動操作，Codex 僅唯讀核對；未將此證據擴大宣稱為 Kick／Ban／Purge 或新增選單的真實驗收。

### 案件選擇體驗更新

`/mod detail`、`/mod note` 先選 user，再點 case_id 欄位；`/mod untimeout` 先選 user 再點 related_case_id，`/mod unban` 先填 user_id 再選 related_case_id。動態選單包含完整案件 UUID、操作、Guild 時區時間與狀態；最多顯示最近 25 筆符合條件的案件，輸入 UUID 前綴可搜尋較舊案件。解除指令僅列出同 Guild、同對象且成功的原 timeout／ban 案件。這是案件欄位的選單，不會在只選人時額外發送公開訊息；沒有權限／未選人時不顯示案件。原因與備註不進選單。

明細與備註執行時重新核對選定對象及案件 ID，解除處分維持既有後端檢查。選單不是授權憑證，也不代表目前 Discord 處分仍有效；例如已到期禁言仍會在實際執行時被目標檢查拒絕。新增程式需手動重啟載入，未代為重啟。

1. 使用者 Ctrl+C 停止，再雙擊根目錄 `00_啟動PulseTools.cmd`。本階段不新增 Gateway Intents 或修改 .env。
2. 在測試 Guild 各自啟用 PT-04、PT-05、PT-08。用 `/module health` 查看實際 DB 探測。
3. 用 `/config channel purpose:moderation` 及 purpose:error 設定各自可發送頻道。`/system status` 確認 uptime、真實 Guild 數、API／DB 延遲；約一分鐘後 `/system history` 應有樣本。
4. 先選低階且同意參與的測試成員，執行 `/mod warn`，填 reason 並從選單選 confirm=True；查看案件 ID、history、detail，新增 note 後核對備註。Warn 不會私訊目標。
5. 權限不足、同級／高階目標、Guild Owner、未確認或 Lockdown 下，應拒絕操作。測試人員須有目前 Guild 內部授權及該操作原生權限；只授予內部 Moderator 不會取得 Discord 權限。
6. 查看 `/error list`／detail／stats；必要時確認安全錯誤。相同拒絕短時間重複應合併，通知不洗版。Owner 可用 global:true 查看全域 Gateway 等錯誤。
7. 禁言／解除、踢除、封鎖／解除與 purge 的真實測試，須先明確指定 Guild、同意參與的目標與專用可刪除頻道。Codex 不代為執行，無真實證據前保持待驗收。
8. 使用者手動重啟，確認案件、備註、模組與路由持久化；確認停止採樣不影響另一個 Guild。不要在既有實際使用設定上測試 reset；設定匯出／匯入可先使用專用測試設定。

## 使用者驗收結果

2026-10-09：使用者確認案件選單正常使用，並回報剩餘手動測試全部通過：踢除與重新加入、封鎖／解除封鎖、專用頻道 Purge 保留釘選訊息、Lockdown 拒絕管理操作及解除後復原、錯誤查詢與確認、手動重啟後案件／備註／設定／模組與健康歷史保留。此為使用者回報，Codex 未代為執行以上真實操作，也未逐項獨立核對 Discord。

Phase 4 階段驗收通過；Phase 5 的實作與真實 R2 驗收另行記錄。

## 官方依據

- [Discord Modify Guild Member：Timeout 與原生權限](https://docs.discord.com/developers/resources/guild#modify-guild-member)
- [Discord Bulk Delete Messages：數量與兩週限制](https://docs.discord.com/developers/resources/message#bulk-delete-messages)
- [Discord Role Hierarchy](https://docs.discord.com/developers/topics/permissions#role-hierarchy)
