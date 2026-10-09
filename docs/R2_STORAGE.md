# PT-10 — Cloudflare R2 檔案上傳

## 啟用

機密填入本機 `.env`：R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、R2_BUCKET_NAME。Account ID 為 32 位十六進位識別碼；Access Key 僅授予此 Bucket 的 Object Read & Write。私人模式不需要 R2_PUBLIC_BASE_URL，也不需要將 Bucket 公開。

需要既有 DISCORD_MESSAGE_EVENTS_ENABLED=true、GuildMessages 與 Message Content Intent。缺少 R2 設定或 Intent，PT-10 顯示 Unavailable；其他模組繼續可用。Database migrations 0006–0008 需先執行，啟動不自動 migration。

由使用者手動 Ctrl+C，再雙擊根目錄啟動檔。每個 Guild 獨立執行：

1. `/module enable id:PT-10`
2. `/r2 status`
3. Owner 用 `/r2 access add user:自己` 加入本人，再逐一加入可使用者；用 list 查看、remove 撤銷。名單按 Guild 隔離，預設空白，Owner／Guild Admin 都沒有隱含上傳權限。
4. `/r2 channel add channel:測試頻道`
5. `/r2 config access:private`（預設私人）
6. `/r2 test`：只做 HeadBucket，不上傳物件。

Bot 在來源及結果頻道需要 View Channel、Send Messages、Embed Links、Read Message History。預設結果發到來源頻道；可用 result_channel 指定目前 Guild 的文字頻道。

## 操作與授權

只有已授權 Guild、啟用 PT-10、設定的頻道及符合政策的附件才提出詢問。Bot／Webhook 訊息不觸發；不下載任意 URL。確認前不下載附件或寫入 R2。

只有 Owner 手動加入此 Guild 名單的人可以提出或確認上傳。原上傳者操作自己的請求；操作別人的請求仍需目前 Guild 內部 Admin 加 Discord Administrator（Owner 仍需目前 Guild 授權），且操作人與原上傳者皆在名單內。操作時核對 Guild、頻道、詢問訊息 ID、Request ID、對象與狀態。其他人被拒絕。撤銷使用者授權、Lockdown、頻道移除、模組停用及存取模式變更會拒絕舊確認。

預設五分鐘內確認，十五秒週期清除過期按鈕；若詢問已刪除或編輯失敗，後端仍拒絕過期操作。取消不下載、不上傳。每個 Guild／來源訊息只建立一個請求，資料庫原子 claim 只讓一個確認進入上傳。

預設每檔 10 MiB、每訊息 5 檔，支援 png、jpg（含 jpeg）、webp、gif、pdf；可設定 mp4、mp3、zip。上限每檔 25 MiB、每訊息 10 檔。副檔名、Discord MIME（若存在）與實際內容探測需一致；不提供病毒掃描。一次最多兩個請求處理中，超出時本次未上傳，需稍後重新發送附件。

## 下載模式

私人模式提供一小時有效的 GET 簽署 URL；結果訊息中的檔名標題可點擊。持有連結的人在有效期內可查看／下載，請把結果頻道限制在適當人員。上傳名單只限制 Bot 上傳功能，不是圖片網址的訪客登入名單。Custom Domain 公開網址仍可由持有網址的人查看；如需訪客登入驗證，需另外建立授權入口，目前未提供。

新上傳 PNG／JPEG／WebP／GIF 設 Content-Disposition:inline，可直接在瀏覽器顯示。PDF／ZIP／其他類型維持 attachment。私人圖片簽署 URL 也用 inline；既有物件的 metadata 不會自動修改，因此原本的公開圖片仍可能下載，重新上傳後套用新規則。

資料庫不保存簽署 URL、R2 憑證或原附件 URL；只保存 Object Key 與必要檔案中繼資料。

`/r2 file info id:RequestUUID` 可重新取得連結：上傳者只查自己的請求；授權 Admin 可查目前 Guild。`/r2 files` 限 Admin，最多最近 25 筆。訊息文字／檔案內容不存入 R2 請求表。

私人短期連結不能取代永久檔案入口，因此停用「上傳並刪除原訊息」。只有 Owner 在本機設定 HTTPS R2 Custom Domain、Guild 設定 access:public 與 allow_delete:True，且 Bot 具備 Manage Messages，才開放刪除。R2 S3 API Endpoint 或 r2.dev 不作為永久公開下載網址。此流程不自動更改 Bucket 公開設定。

## 安全流程與恢復

確認 → 原子 claim → fetch 最新原訊息／附件 → 限時 CDN 串流至隨機暫存檔 → 內容驗證 → 記錄預計 Object Key → SDK 上傳 → HeadObject 比對長度、MIME、SHA-256 metadata → 保存 Uploaded → 建立並檢查下載連結 → 發布替代訊息 → 保存結果訊息 ID → 再檢查政策／附件／刪除權限 → 可選刪除 → Completed。

Object Key 為 `guild_id/prefix/YYYY/MM/uuid-安全檔名`，UTC 年月；PutObject 使用 If-None-Match:*，不覆蓋既有物件。SDK maxAttempts=1，不自行重做不確定的寫入；失敗／部分成功不回到 Pending。部分附件失敗、連結或替代訊息失敗皆不開始刪除；已完成的物件保留，不自動刪除。刪除 API timeout 的結果可能不明，顯示 PartiallyCompleted 並要求人工核對，不盲目重刪。

程序重新啟動把 Uploading／Uploaded 請求轉 PartiallyCompleted、尚未確認的物件轉 Unknown；不自動重傳、發送或刪除。Unknown Object 需人工核對 Bucket，本階段沒有自動對帳／清除孤立物件。尚在有效期的 Pending 按鈕可繼續使用。

一般成功／失敗與正常 Ctrl+C 均中止串流並清除暫存檔。強制終止程序／作業系統當機可能留下系統 TEMP 中的 pulsetools-r2-* 目錄；確認 Bot 已停止後可清理這些專用暫存目錄，不要清除整個 TEMP。

上傳狀態變化存 r2_upload_events；錯誤以 PT-10 / R2 / 固定安全代碼進 PT-08，不保存第三方原文、Secret、URL 或 Stack。確認成功刪除後，PT-01 實際 message.delete Audit 可關聯 upload_request_id；先到或後到的 Gateway 事件均可關聯。刪除授權亦記錄安全操作歷史；不推測其他人造成的刪除。

Dashboard Cloud Storage、搜尋與分頁由 Phase 6 實作；目前只提供 Bot 指令與共用 Core Service。

## 官方依據

- [Cloudflare AWS SDK v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
- [Cloudflare 簽署 URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

2026-10-09：新增 r2_upload_users 授權表與 0009 migration；授權／撤銷存安全操作歷史，不自動加入任何人，也不自動修改 Bucket 或既有 Guild 下載模式。
