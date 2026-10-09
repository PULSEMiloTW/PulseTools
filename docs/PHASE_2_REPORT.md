# Phase 2 — Audit 基礎

日期：2026-10-09。原始碼、資料庫整合及指令準備完成；真實 Discord 訊息驗收待使用者手動重啟。尚未進入 Phase 3。

## 已實作

- 原始 Gateway 訊息建立、編輯、單筆及批次刪除接收；DM 與可辨識 Bot 訊息排除。不從快取補造原文、不 fetch 已刪除訊息。
- EventRouter 按 Guild / Message 序列化，有界佇列 1000 筆、有限交易重試、安全代碼、停止時等待處理完成。滿載事件會拒絕並輸出 AUDIT_QUEUE_FULL；沒有承諾離線期間不遺失事件。
- audit_events、message_snapshots、message_versions；事件與版本在同一 PostgreSQL 交易保存。Guild / eventKey 唯一鍵及 Snapshot 列鎖防止重複版本。
- 建立原文、版本歷史、最新已知內容及刪除狀態。更新後才開始捕捉不偽造建立原文，部分內容標 Partial，缺失標 Unavailable。亂序更新不覆蓋最新內容。
- UTC timestamptz；建立時間由 Discord Snowflake 取得，編輯時間採實際 edited_timestamp，刪除時間標 received，刪除操作者標「無法確認」。缺少編輯時間的更新採固定 unavailable 去重鍵，無法承諾區分所有此類更新。
- 原文預設關閉；白名單頻道、排除頻道、隱私告知、viewer 清單及每 Guild 保存期限。新增捕捉範圍或重新開放排除頻道須明確確認。
- /logs capture enable 只有 confirm:true 才在指定頻道公開隱私告知；成功公告後儲存政策。若後續設定交易失敗，公告可能已存在，錯誤回覆不會宣稱保存已啟用。
- 原文查閱為 Ephemeral JSON 附件，須 Owner 或同 Guild 明確 viewer、內部 admin 及 Discord Administrator；查閱寫入 security_events，不含原文。
- 每小時及啟動時清理過期 Audit / Snapshot / Version，版本以外鍵級聯刪除。原文期限按訊息建立時間計算，編輯不延長；縮短政策即刻影響查閱。Bot 停止期間不執行排程。
- 三張新表啟用 RLS、無匿名或 authenticated 讀取政策，避免 Supabase Data API 直接讀取原文。Bot 使用後端資料庫角色；仍需保持 Data API 停用。
- DISCORD_MESSAGE_EVENTS_ENABLED 預設 false；本次程序未啟用時 PT-01 顯示 Unavailable，舊設定保留。Phase 3 的通知路由、其他事件尚未提供。

## 檢查

- Strict TypeScript、49 項離線測試及 build 已通過。
- 真實 Supabase 隔離 Schema 整合測試：完整 migrations、兩 Guild 隔離、原文預設、確認、編輯刪除、重開連線、並行去重、未知原文、亂序、排除、事件開關、模組停用、viewer、RLS、retention、撤銷。
- 測試只在本次新建 pt_test_UUID Schema 執行；不修改正式 Guild 設定，不留下測試原文。
- 不把測試資料或 DB 連線成功當作 Discord Gateway 驗收。
- 14 項真實 PostgreSQL 整合測試通過；正式專用專案已套用 0001、0002 additive migrations，doctor 通過。
- 六個頂層指令已註冊至既有授權測試 Guild：歡樂Ma屋 1317365273573064714、Pulse Studio HQ 1557255271758303252。未代為啟停 Bot、未修改 .env 或開啟原文捕捉。

## 使用者手動驗收

1. Discord Developer Portal → PulseTools Application → Bot → Privileged Gateway Intents，啟用 **Message Content Intent** 並 Save Changes。未開啟而程式要求此 Intent 會被 Discord 以 4014 拒絕。
2. 在本機 .env 新增 `DISCORD_MESSAGE_EVENTS_ENABLED=true`。其他機密不變。
3. 舊控制台 Ctrl+C 停止，再雙擊根目錄 `00_啟動PulseTools.cmd`。
4. 在 Pulse Studio HQ 與歡樂Ma屋各執行 `/module enable id:PT-01`、`/logs status`。此時原文仍關閉。
5. 在其中一個 Guild 的專用測試頻道執行 `/logs capture enable channel:指定頻道 notice:此頻道測試訊息將保存30天，僅授權管理者可查閱 confirm:true`。這會公開發送告知；選用適當文字及頻道。
6. 發送不含機密的測試文字「Phase2 版本一」，先複製 Message ID，再編輯為「Phase2 版本二」，自行刪除這則測試訊息。
7. `/logs recent` 應顯示建立、編輯、刪除。`/logs snapshot message_id:剛才的ID` 附件應保留 originalContent、編輯與刪除版本；刪除操作者不得被猜測。
8. 在另一 Guild 查相同 ID 應顯示 Unavailable。在未指定頻道建立並刪除測試訊息，不應保存原文。`/logs capture exclude` 後停止該頻道原文保存及查閱；`/logs capture disable` 停止新原文並關閉查閱。
9. 手動重啟後確認設定及未過期 Snapshot 仍保存。PT-01 停用時新訊息不再寫入 Audit；啟用後才恢復。

只需回報 /logs status、/logs recent 與是否符合上述結果；不用貼原文附件或任何 Secret。

## 官方依據

- [Discord Gateway Intents](https://docs.discord.com/developers/events/gateway#message-content-intent)
- [Discord Message Gateway Events](https://docs.discord.com/developers/events/gateway-events#message-update)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
