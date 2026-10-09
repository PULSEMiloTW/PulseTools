# 測試

## 離線必要檢查

`npm run check` 執行 Strict TypeScript、Vitest 離線測試與 build。離線測試涵蓋 Owner、Guild、內部角色、Lockdown、設定驗證與衝突、兩 Guild 隔離、模組生命週期、初始化錯誤、重啟服務恢復、Embed、安全錯誤、Timestamp 與指令結構。

離線 MemoryRepository 與 Discord Interaction mock 明確只用於 tests；不能當作 DB 持久化或 Discord 登入證據。

## PostgreSQL 整合測試

`npm run test:database` 需要專用空 TEST_DATABASE_URL。缺少連線時會明確失敗，不靜默 skip 或偽造通過。測試執行 migration、兩 Guild 隔離、重開連線持久化、交易衝突、操作歷史、UTC、模組恢復與授權撤銷。

資料庫名稱須含 test，且不能與 Bot DATABASE_URL 相同。已有資料表時拒絕執行，不 truncate / DROP，測試後保留證據。CI 使用隔離 PostgreSQL 容器；CI 尚未執行不能宣稱通過。

Supabase 提供另一個明確的測試命令：`npm run test:database:sandbox`。使用 DATABASE_URL 建立唯一 pt_test_UUID Schema，連線 search_path 不含 public。測試套用同一份 Migration SQL，FK 的 public 前綴僅在測試執行時換成自身 Schema，不修改生成檔；測試結束只 DROP 本次成功新建的 Schema。所有正式表與 Guild 設定保留。

## 真實 Discord 驗收

依 WINDOWS_SETUP.md 檢查真正登入、指令互動、授權隔離、原生權限、Presence 與重啟。不得用 TypeScript 通過替代 Discord 上線證據。

Phase 1 不包含可見網頁修改，無 Dashboard browser 驗收；Phase 6 必須做代表性畫面、互動及 console 驗證。

Phase 2 額外驗證 EventRouter 佇列、重試、停止、Gateway 缺失欄位與政策預設；PostgreSQL 整合驗證原文確認、版本、刪除、重開連線、去重、Guild / 頻道隔離、viewer、RLS、期限縮短及級聯清理。真實訊息與手動重啟步驟見 PHASE_2_REPORT.md，未完成前不得進入 Phase 3。

Phase 3 加入成員／語音差異、通知 Embed、mention 防護、Worker 重入／未就緒／取消、Discord 限流與權限失敗、成功發送後 DB 寫回失敗等測試。PostgreSQL 測試包含 Server / Outbox 同交易、RLS、路由、去重、Pending／Sent 持久化、Sending 不明狀態恢復、重試上限及清理。保存期限案例含多次遠端 DB round trip，單案例時限 15 秒，不擴大全部離線測試時限。Phase 3 真實 Gateway／通知驗收見 PHASE_3_REPORT.md；測試 transport 不對 Discord 發送訊息。

Phase 4 加入 Moderator 內部授權／原生權限邊界、階級／目標拒絕、確認與禁言期限、外部執行前案件保存、失敗／Unknown／重複指令、健康真實數值／Degraded／採樣生命週期、錯誤查閱／全域隔離及附件匯入限制。隔離 PostgreSQL 驗證案件與備註複合 FK、並行去重、關聯解除、Pending 恢復、四表 RLS、管理通知開關、錯誤聚合／通知／確認及健康期限清理。測試 transport 不執行真實處分；真實驗收與已知限制見 PHASE_4_REPORT.md。

Phase 5 使用 mock SDK／Discord／fetch，測試確認前不下載、取消、按鈕授權與對象核對、並行確認、多附件部分失敗、結果與刪除順序、最新政策撤銷、過期、實際內容探測、限量串流、Head 比對及暫存清理。隔離 PostgreSQL 驗證四表 RLS、複合 FK、Guild 設定與檔案隔離、claim 去重、過期、重啟 Unknown 及 Audit 刪除事件先後到關聯。真實驗收見 PHASE_5_REPORT.md；SDK mock 不寫入 R2。
