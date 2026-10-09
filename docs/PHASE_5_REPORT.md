# Phase 5 — Cloudflare R2

2026-10-09：原始碼與自動驗證完成，真實上傳待驗收；私人 Bucket HeadBucket 唯讀連線已通過，尚未真實上傳、發送 R2 詢問、刪除訊息或代為重啟。

## 範圍

新增 PT-10 附件偵測、三個確認按鈕、持久請求與檔案事件、附件 URL／大小／副檔名／MIME／內容探測、SDK 串流上傳、Head 驗證、下載連結、替代訊息、受保護刪除及原子去重。預設私人模式、無監聽頻道、禁止刪除，所有啟用與測試由使用者操作。

修改 Bot main／commands／interaction handler，新增 r2-commands 與 r2-transport；Core r2-service／r2-storage／r2-store；Shared r2；Database r2-repository、Schema 與 migrations 0006–0008。沿用原架構；Audit 只增加已確認 R2 刪除的請求關聯，既有原文政策不變。新增 SDK v3、簽署 URL 與 file-type 依賴。

## 驗證紀錄

- 私人 Bucket：HeadBucket 通過；沒有 R2 寫入或刪除。
- 離線：測試覆蓋權限、Guild／訊息隔離、取消、去重、多附件失敗、連結／結果／刪除失敗、政策撤銷、過期、內容驗證、暫存清理；104 項離線測試、Strict TypeScript 與 build 通過。
- PostgreSQL：隔離 Schema 完整 migration、RLS、請求去重、跨 Guild FK／讀取／設定、過期及重啟 Unknown、Audit 前後到關聯；29 項隔離 PostgreSQL 測試通過。
- 專用 Supabase 已套用 0006–0008，四張 R2 表 RLS 已唯讀核對，doctor 通過；10 個頂層指令已註冊至原兩個測試 Guild。未修改 .env、模組開關或監聽頻道。
- 真實 Discord Components、R2 Object、下載 URL 與重啟 Pending 請求仍待手動驗收。

## 手動驗收

先讀 R2_STORAGE.md。使用 PulseTools 專用 Bucket、小型無機密 PNG 與專用測試文字頻道；Bot 由使用者手動重啟。每個 Guild 手動啟用 PT-10 並設定監聽頻道。

1. 未監聽頻道附件不出現詢問；監聽頻道符合政策 PNG 出現三個按鈕。
2. 私人模式刪除按鈕停用，原因明確；取消不寫入 Bucket。
3. 他人操作被拒絕；原上傳者上傳並保留後原訊息仍在，Object／歷史／下載連結可核對。
4. 連續點擊同一請求不新增 Object 或重複結果；多個附件均顯示可點擊標題。
5. 約一小時後舊連結到期；原上傳者 `/r2 file info` 可重新取連結。另一 Guild 不可查到此 ID。
6. 五分鐘後過期按鈕停用，後端亦拒絕；在 Pending 時由使用者重啟後仍能確認或按期限過期。
7. 真實失敗測試、公開模式替代訊息／刪除分支需另指定測試條件；目前私人模式不對真實 Discord 執行刪除。這些分支的 mock 通過不等於真實驗收。

Phase 5 真實驗收完成前不進 Phase 6。公開模式、Unknown 人工對帳、Dashboard 介面及病毒掃描的限制詳見 R2_STORAGE.md。
