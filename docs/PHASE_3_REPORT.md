# Phase 3 — 成員及伺服器即時事件

日期：2026-10-09。原始碼與資料庫整合完成；真實語音事件與通知發送已驗證，其他事件的手動驗收進度見下方。尚未進入 Phase 4。

## 範圍

- PT-01 支援訊息建立／編輯／刪除（含 bulk delete 逐筆）、成員加入／離開、暱稱與角色新增／移除、語音加入／離開／切換、角色建立／更新／刪除／權限、頻道建立／更新／刪除／權限覆寫、Guild 基礎設定變更及邀請建立／刪除。
- Discord 成員舊快取缺失時，記為 member.update、before=Unavailable，不猜測新增／移除的角色。頻道／角色變更以實際前後狀態記錄，長清單標示截斷。未改變語音頻道的靜音事件不假冒切換。
- 訊息原文仍只存 Snapshot / Version；主動事件通知只含中繼資料。所有通知輸出頻道（含歡迎頻道）排除訊息捕捉，避免 Bot Embed 更新／刪除造成回授。
- PT-02 可獨立於 PT-01 啟用，提供加入與離開各自頻道、開關、自訂文字、頭像、Guild 名稱、User ID、實際成員總數及可選帳號建立時間。離開原因不推測為踢除或封鎖。
- 模板支援 {guild}、{user}、{user_id}、{count}、{account_created}；文字經統一 Embed 安全處理，不能觸發 mention。
- /logs channel set / list、event set / category、test；/welcome status、channel set、message set、toggle、account、preview、test。
- preview 為 Ephemeral；test 必須由授權管理者主動執行，經 Lockdown 檢查，明確標示「測試通知」，不建立假的 Audit 事件。

## 儲存與發送

- 新增 server_events、notification_outbox，啟用 RLS，無匿名讀取政策。通知與事件在同一交易入庫，失敗會一併 rollback。
- server_events 使用 Gateway session 的雜湊、shard、sequence、事件類型及 entity ID 去重。不保存 Gateway session 原值或邀請碼。
- EventRouter 按 Guild 序列化，各佇列上限 1000；有界交易重試、停止時等待處理完成。滿載會明確輸出 AUDIT_QUEUE_FULL，未承諾所有事件零遺失。
- 即時入庫後喚醒 Worker；另每兩秒處理待發送通知。Outbox 狀態：Pending、Sending、Sent、Failed、Cancelled，保留 attempts、sentMessageId、errorCode。
- SKIP LOCKED 取任務；同一 Worker 不重入，最多一次處理十筆。發送前重新檢查 Guild 授權、模組、事件開關、期限及目前路由。路由改動／模組停用後取消舊通知，不轉發到新頻道。
- 500／429 類可重試失敗由 Worker 最多嘗試三次並退避；discord.js 自身負責官方限流排程。無權限／頻道不存在則 Failed，錯誤碼持久化，/logs status 顯示最近失敗。
- 發送採固定 nonce 與 enforceNonce，提供 Discord 支援的短時間防重。Sending 在程序中斷後視為 DELIVERY_UNKNOWN，不自動重送；不能承諾跨任意長度中斷的 exactly-once。
- PT-01 Audit 與 PT-02 歡迎指向同一頻道時，該次成員事件只排一筆歡迎通知。指向不同頻道時，各自通知。
- 停機期間 Pending 留在 PostgreSQL；重啟後僅發送仍符合政策的通知。所有新增資料遵循 Audit 保存期限，啟動及每小時清理。Bot 離線期間的 Gateway 活動不保證補回。

## 保留既有設定

舊 Guild 的事件清單不自動擴大。Phase 2 已保存 audit.enabledEvents 的 Guild，須以 /logs event category 開啟所需新分類。新 Guild 預設支援全部已實作類型，但業務模組仍預設停用、原文預設關閉。

成員 Gateway 接收需 Discord Portal **Server Members Intent** 與本機 DISCORD_MEMBER_EVENTS_ENABLED=true；未開啟時 PT-02 Unavailable，不虛報運作。訊息保留既有 Message Content Intent 與 DISCORD_MESSAGE_EVENTS_ENABLED=true。

GuildVoiceStates / GuildInvites 隨新版啟動載入。邀請事件另需對來源頻道具 Manage Channels；本階段不新增該權限或代為建立邀請。Guild Audit Log 操作者相關、管理案件與完整 Error Center 屬 Phase 4。

## 檢查與實際環境

- Strict TypeScript、58 項離線測試及 build 通過；公開測試指令在 Lockdown／缺少內部角色時不會排入通知。
- 21 項真實 PostgreSQL 隔離 Schema 測試通過：全部 migrations、RLS、事件去重、同交易 Outbox、分類路由、Guild 隔離、原文不進 Outbox、回授排除、PT-02 獨立、共用頻道合併、並行取任務、重開連線、Sent / DELIVERY_UNKNOWN、重試上限與保存期限。
- 所有測試通知僅在隔離 Schema 與 mock transport 執行，沒有對真實 Discord 頻道發送訊息。
- 專用 Supabase 已套用 0003_plain_romulus migration，兩張新增表與 RLS 驗證通過，doctor 通過；七個頂層指令已註冊至既有兩個授權測試 Guild。
- 本機成員事件旗標仍為 false，未修改 .env、Guild 路由或模板，未代為啟停 Bot。新增程式須由使用者手動重啟才載入。
- 真實 Gateway 與通知發送尚待下方手動驗收；不以離線測試或 migration 成功代替。

## 手動啟用與驗收

### 2026-10-09 實際驗收進度

- 使用者已手動載入新版。歡樂Ma屋的真實 `voice.join`、`voice.switch`、`voice.leave` 各一筆已保存；對應三筆 PT-01 Outbox 均為 `Sent`、`isTest=false`，無錯誤碼。使用者確認操作完成，事件入庫到自動通知的完整流程通過。
- 歡樂Ma屋 PT-02 加入與離開測試通知各一筆、Pulse Studio HQ PT-01 訊息測試通知一筆均為 `Sent`，無錯誤碼。測試通知不視為真實成員或訊息事件。
- 後續驗收：歡樂Ma屋真實 `member.join`、`member.leave` 各一筆，兩種事件的 PT-01 與 PT-02 通知均為 `Sent`；另有兩筆 `member.role.add` 與成功的 PT-01 通知。Pulse Studio HQ 真實 `member.join` 一筆，其 PT-01 與 PT-02 通知均為 `Sent`。兩個 Guild 各有真實 `invite.create`、`invite.delete` 與成功的 PT-01 通知；上述均 `isTest=false`、無錯誤碼。
- 歡樂Ma屋另有一筆真實 `channel.update` 紀錄。角色本身建立／更新／刪除及重啟後設定與通知持久化仍待手動驗證，尚未宣稱 Phase 3 全部驗收完成。
- `direction` 在 Discord 選單顯示為「加入」與「離開」；下方 `join` / `leave` 為內部值。操作時應從下拉選單選取，不能直接貼上內部值當成已選定的選項。

1. Developer Portal → PulseTools → Bot → Privileged Gateway Intents，開啟 **Server Members Intent** 並儲存。保持 Message Content Intent 啟用。
2. 本機 .env 新增 `DISCORD_MEMBER_EVENTS_ENABLED=true`；不需要貼任何機密。
3. 舊控制台 Ctrl+C 停止，再雙擊 `00_啟動PulseTools.cmd`。使用 /pulse setup 檢查本次 Intents。
4. 兩個授權 Guild 各使用 `/module enable id:PT-02`。PT-01 保持啟用。
5. 在目前 Guild 設定專用紀錄頻道：`/logs channel set category:message channel:紀錄頻道`、voice、member、system 可各選不同頻道。通知輸出頻道勿作為原文測試來源。
6. 舊設定按需啟用 `/logs event category category:voice enabled:true`、member、system；message 的既有事件設定保持原值。
7. `/welcome channel set direction:join channel:加入通知頻道`，leave 可指定另一個頻道。用 /welcome preview 私密檢視；/welcome test 會在設定頻道公開發送標示測試的通知。
8. `/logs test category:message`、voice 等確認基本發送；/logs status 的 Sent、Failed、Pending 應反映實際結果。沒有設定頻道的分類只保存事件，不發送。
9. 在非通知輸出頻道發送／編輯／刪除自己的測試訊息；加入、切換、離開語音，確認事件實際入庫並自動發送 Embed。成員加入／離開可由願意參與的測試帳號自行操作，不需踢除／封鎖。
10. 若選擇驗證角色、頻道及邀請事件，僅自行操作可回復的測試項目。Codex 未代為修改 Discord Guild、建立邀請或發送測試訊息。
11. 兩 Guild 使用各自設定，停用 PT-01 應停止新 Audit；PT-02 可繼續通知。手動重啟後路由、模板與待發送狀態持久化。

回報 /logs status、是否收到自動 Embed 及事件種類即可；不需貼 Snapshot 原文附件。

## 官方依據

- [Discord Gateway 與 Privileged Intents](https://docs.discord.com/developers/events/gateway#privileged-intents)
- [Gateway Events 與邀請權限](https://docs.discord.com/developers/events/gateway-events#invites)
- [Message nonce 防重範圍](https://docs.discord.com/developers/resources/message#create-message)
