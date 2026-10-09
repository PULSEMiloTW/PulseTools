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

OAuth2 Session / CSRF 與 R2 安全串流尚未實作，不能對外部署或宣稱完整產品安全驗收。後續實作須遵守 Master Prompt 與 PT-10 安全狀態機。

Phase 3 通知只包含嚴格 Schema 的中繼資料，不複製訊息原文至 Outbox；不保存 Gateway session 原值或邀請碼。新增兩表啟用 RLS。通知目標只能由授權管理者選擇本 Guild 頻道，發送前重新檢查授權、模組與路由；所有 mention 關閉。Preview 不公開，test 需主動指令且經 Lockdown 檢查。無法確認的發送結果記為 DELIVERY_UNKNOWN，不擅自重送；原文依然只透過授權 Snapshot 存取。

Phase 4 案件與備註以複合 FK 保護 Guild 隔離，查閱仍經 Core 內部／原生權限檢查。處分先保存 Pending，再驗證最新權限與角色階級；結果不明時不重試。REST 自動 500／timeout 重試關閉。管理原因與備註不進公開通知，錯誤不保存第三方原文或 Stack Trace。JSON 匯入具來源、期限、串流大小、嚴格 Schema、Guild 頻道及版本檢查，不能繞過 capture 的明確告知流程。

PT-10 僅由 Discord Attachment 偵測提出詢問；不接受使用者任意 URL。確認核對 Guild／來源頻道／詢問 ID／Request ID／Actor，原子 claim 防重。下載來源只允許 Discord HTTPS CDN 附件路徑、禁止 redirect，限制時間與實際串流大小；檔案類型以內容探測與副檔名／MIME 一致性驗證。私人連結有效一小時，持有者可下載，不能作為永久入口；原訊息保留。短期連結不存入資料庫或 logs。Object 結果不明時不盲目重傳，Unknown 需人工核對；一般暫存清理與強制終止的限制見 R2_STORAGE.md。
