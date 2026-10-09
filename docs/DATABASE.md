# 資料庫

PostgreSQL 是唯一正式持久化資料來源。建議使用專用資料庫與非 superuser 執行角色。Drizzle Schema 位於 packages/database/src/schema.ts，SQL Migration 位於 packages/database/migrations。

Phase 1 建立：

| 資料表 | 用途 |
|---|---|
| guilds | Guild 授權、名稱、設定 JSON、revision、建立與更新時間 |
| guild_administrators | Guild / User 複合主鍵與內部角色 |
| module_states | Guild / Module 複合主鍵、enabled、health、更新時間 |
| configuration_history | 每次成功設定更新與操作者 |
| security_events | 管理變更與已授權 Guild 的查詢歷史 |
| system_settings | Owner Lockdown 等全域安全設定 |

所有時間欄位使用 `timestamp with time zone`；連線強制 `timezone=UTC`。管理事件時間來源標示 `received`，不偽造 Discord 事件精確時間。

Guild Allowlist 變更是 Owner 全域事件，guild_id 為 null，details 中保留 targetGuildId；不對未授權 Guild 建立普通業務活動紀錄。Guild 撤銷授權不刪除歷史資料。

```powershell
npm run db:generate
npm run db:migrate
```

Bot 啟動不自動 migration。schema 異動應生成並審查 migration，備份與正式 migration 必須依使用者授權執行。

Phase 2 新增 audit_events、message_snapshots、message_versions；三表啟用 RLS、沒有前端存取政策。後端連線須為表 owner 或具 BYPASSRLS 的受保護角色；不可把這個連線交給瀏覽器。獨立執行角色須另配置僅後端使用的 RLS 政策及 GRANT，不能直接停用 RLS。Guild / eventKey 去重、Guild / Message 複合主鍵、Snapshot 列鎖及版本唯一鍵保護資料一致性。Snapshot 到期刪除時，版本級聯移除。政策保存在既有 Guild JSON 與設定歷史，未建立第二份政策來源。R2 表仍待後續階段。

`test:database` 使用專用空資料庫，檢查 public / drizzle 尚無資料表後才執行 migration；不會清空或刪除既有資料。

Phase 3 新增 server_events 與 notification_outbox，均啟用 RLS。metadata / payload 使用嚴格 Schema，不存訊息原文、邀請碼或 Gateway session 原值。事件／通知交易去重，SKIP LOCKED 取任務、持久化發送狀態與安全失敗代碼。Pending 可於重啟恢復；Sending 結果不明則 Failed / DELIVERY_UNKNOWN，不能自動推定未發送。新增資料按 Guild Audit 期限清理。

Phase 4 新增 moderation_cases、moderation_notes、error_records、health_samples（0004／0005），四表 RLS 無匿名政策。案件以 Guild／Interaction 去重，關聯案件與備註具 Guild／Case 複合 FK；原始案件不被解除處分覆寫。健康樣本保存 30 天，案件與安全錯誤保留歷史。錯誤以五分鐘窗合併，保存安全代碼與確認者；不保存原始 Stack Trace。管理通知與錯誤通知沿用 Outbox。此階段不更改既有 Guild 設定或自動啟用模組。

Phase 5 新增 r2_guild_settings、r2_upload_requests、r2_uploaded_objects、r2_upload_events，均啟用 RLS，沒有匿名政策。複合 Guild／Request FK、Guild／Message 去重及唯一 Object Key；請求狀態 SQL check 與原子 Pending claim。0006 先建立複合唯一索引再建立 FK；0007 為 audit_events 加入已確認 R2 刪除的 upload_request_id；0008 新增物件 uploaded_at。時間均 UTC，不保存附件 URL、簽署 URL 或 R2 憑證。

0009 新增 r2_upload_users：Guild／User 複合主鍵、Guild FK、授權者與 UTC 建立時間，啟用 RLS。授權名單與上傳設定分表，避免設定 JSON 更新覆蓋權限撤銷；授權／撤銷和安全歷史同交易保存。舊 Guild 沒有自動加入的使用者。
