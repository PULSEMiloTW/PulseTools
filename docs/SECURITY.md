# 安全

- .env 與執行檔案不進 Git；.env.example 機密值全為空白。
- 錯誤只輸出安全代碼或本程式建立的設定名稱訊息，不打印第三方例外、HTTP Request、DB URL 或訊息原文。
- 每個敏感指令後端驗證 Owner / Guild / 內部角色 / Discord 權限；不得只靠指令顯示權限。
- Owner Allowlist 外不蒐集普通活動資料；新 Guild 預設原文保存停用。
- Guild 查詢及設定都帶 Guild ID；L1 權限要求相同 Guild 的內部授權與 Discord Administrator。
- 設定 Schema 拒絕不支援欄位，避免以配置匯出混入 Secret。
- 主動回覆禁止 mention，使用 Ephemeral，遵守 Embed 限制。
- DB 設定寫入與歷史在同一交易，revision 避免競爭覆蓋。
- PostgreSQL advisory lock 防止重複 Bot；失去連線時停止，避免雙重處理。
- Drizzle Kit 間接開發依賴的 esbuild 使用 override 至 ^0.25.0，避免已知開發伺服器漏洞；不啟動 Drizzle Studio 對外服務。

Phase 2 已實作 Audit / 原文保存期限清理、指定及排除頻道、隱私告知、viewer 授權、查閱紀錄及三張原文相關表的 RLS。原文不進普通 Debug Logs。啟用及擴大捕捉範圍需明確確認；關閉保存時同時關閉原文查閱。原文 JSON 附件只透過 Ephemeral 回覆給授權者；已下載附件不在 Bot 可撤回範圍內。

OAuth2 Session / CSRF、R2 安全串流與完整 Error Center 尚未實作，不能對外部署或宣稱完整安全驗收。後續實作須遵守 Master Prompt 與 PT-10 安全狀態機。

Phase 3 通知只包含嚴格 Schema 的中繼資料，不複製訊息原文至 Outbox；不保存 Gateway session 原值或邀請碼。新增兩表啟用 RLS。通知目標只能由授權管理者選擇本 Guild 頻道，發送前重新檢查授權、模組與路由；所有 mention 關閉。Preview 不公開，test 需主動指令且經 Lockdown 檢查。無法確認的發送結果記為 DELIVERY_UNKNOWN，不擅自重送；原文依然只透過授權 Snapshot 存取。
