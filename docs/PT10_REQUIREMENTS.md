# PulseTools v0.6 — 新增 PT-10 Cloudflare R2 File Upload Module

請在既有 PulseTools 專案中新增第十個模組：

**PT-10｜Cloudflare R2 File Upload & Management**

本需求是既有 Master Prompt 的功能擴充。必須保留原有九個模組、Multi-Guild 架構、Owner 權限、統一 Embed Design System、Dashboard、Timestamp System 與 Windows 部署能力。

不要重寫或破壞原有功能。

## 一、核心需求

建立指定 Discord 頻道的檔案上傳管理功能。

當成員在已啟用的頻道發送包含附件的訊息時：

1. 偵測符合條件的新附件。
2. 使用 PulseTools Embed 回覆詢問是否上傳至 Cloudflare R2。
3. 提供三個互動按鈕：
   - 上傳並保留原訊息
   - 上傳並刪除原訊息
   - 取消上傳
4. 僅允許原上傳者或被授權管理員操作。
5. 確認後才下載附件並上傳至 R2。
6. 上傳成功後，驗證 R2 Object 已建立。
7. 回傳檔案的可用連結與基本資訊。
8. 視使用者選項決定是否刪除 Discord 原始訊息。
9. 所有操作均建立 Timestamp 與歷史紀錄。

禁止自動上傳未經確認的檔案。

## 二、訊息移除規則

若選擇「上傳並刪除原訊息」：

- 上傳 R2 成功前不得刪除原訊息。
- 驗證 Object 成功且取得可用連結後，先發布包含連結的替代訊息。
- 確認替代訊息成功發布後，才刪除 Discord 原始訊息。
- 不得嘗試編輯其他成員的原始訊息以移除附件。
- 刪除其他成員訊息前，必須確認 Bot 擁有 Manage Messages 權限。
- 如果沒有刪除權限，停用此操作選項並說明原因。
- 如果替代訊息發送失敗，保留原始訊息。
- 如果刪除失敗，保留原始訊息，回報部分完成狀態。
- 不可因重試而重複上傳或發布多則結果。

如果原始訊息包含文字，刪除時會一併移除。替代訊息以檔案連結及必要識別資訊為主。

本功能僅刪除 Discord 原始訊息，不代表刪除 R2 Object 或既有 Audit Log。

## 三、Discord 互動設計

使用 Discord 官方支援的 Buttons / Message Components。

使用統一 Embed Builder。

Title：雲端檔案上傳

內容顯示：

- 上傳者
- 檔案名稱
- 檔案數量
- 檔案大小
- 是否上傳 Cloudflare R2

Footer：

Powered by Pulse Studio

使用原生 Timestamp。

待確認訊息應設定合理的操作有效期限，建議初始為五分鐘，可調整。

過期後停用按鈕。

如果原附件已無法取得，提示重新上傳，不得回報成功。

處理按鈕時必須驗證：

- Interaction User ID
- Guild ID
- Channel ID
- Original Message ID
- Upload Request ID
- Current Request Status
- Authorization

使用者只能完成一次有效的上傳確認。

同一請求必須具備冪等處理，避免多次點擊造成重複檔案。

## 四、Cloudflare R2 Integration

使用 Cloudflare R2 S3-Compatible API。

建議使用 AWS SDK for JavaScript v3。

必要設定：

- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME
- R2_PUBLIC_BASE_URL（可選）

設定透過環境變數與安全設定管理，不可寫入原始碼或前端。

Access Key 應限制在指定 Bucket，採取最小必要權限。

上傳處理包含：

- MIME Type Validation
- File Extension Validation
- File Size Validation
- Filename Sanitization
- Object Key Generation
- Streaming Upload
- Upload Verification
- Retry Handling
- Timeout Handling
- Upload Error Logging
- Temporary File Cleanup

不要僅依賴副檔名判斷檔案類型。

不得任意下載使用者提供的外部 URL；本模組只處理經 Discord Attachment 資料驗證的來源。

Object Key 建議採用：

guild_id / year / month / unique-id-original-filename

必須避免不同檔案覆蓋相同 Object Key。

## 五、公開與私人連結

支援兩種檔案存取模式：

### Public Mode

使用已設定的 R2 Custom Domain 產生永久形式的公開連結。

不得將 R2 S3 API Endpoint 直接當成公開下載網址。

### Private Mode

Bucket 維持私人狀態。

透過授權下載機制或具有有效期限的簽署 URL 提供存取。

不得將短期簽署 URL 宣稱為永久有效連結。

公開與私人模式可透過模組設定管理，並由後端驗證。

若沒有可用的公開網域或私人下載機制，應回傳 Object Key 與狀態，清楚說明目前尚無可直接使用的公開連結。

## 六、Multi-Guild 設定

每個 Guild 可獨立設定：

- Module Enabled
- Watched Channel IDs
- Allowed File Types
- Max File Size
- Max Files Per Message
- R2 Object Prefix
- Upload Permissions
- Delete Original Message Permission
- Public / Private Access Mode
- Upload Prompt Timeout
- Upload Result Channel

預設只監聽經管理員設定的頻道。

不可自動監聽所有伺服器附件並上傳。

R2 Credentials 應由 Owner 安全設定，不允許一般 Guild 管理員查看。

## 七、Dashboard Integration

新增頁面：

**Cloud Storage**

包含：

- Upload History
- File Name
- File Size
- Content Type
- Guild
- Channel
- Uploader
- R2 Object Key
- File URL（若存在）
- Upload Status
- Original Message Status
- Created At
- Uploaded At
- Deleted Original At
- Error Details

支援依 Guild、檔名、上傳者、狀態與時間範圍搜尋。

Dashboard 必須顯示 Timestamp，預設 Asia/Taipei。

資料庫使用 UTC 儲存。

所有敏感查詢必須檢查使用者對該 Guild 的存取權限。

## 八、Slash Commands

請規劃並實作：

- /r2 status
- /r2 channel add
- /r2 channel remove
- /r2 channel list
- /r2 config
- /r2 files
- /r2 file info
- /r2 test

Owner 可以管理 R2 全域連線設定。

Guild Admin 只能管理已授權 Guild 的頻道與上傳策略。

一般成員不能查看 R2 憑證或其他 Guild 的檔案歷史。

## 九、資料庫

新增必要資料表：

- r2_upload_requests
- r2_uploaded_objects
- r2_guild_settings
- r2_upload_events

資料應記錄：

- Request ID
- Guild ID
- Channel ID
- Message ID
- Uploader ID
- Attachment ID
- Original Filename
- Object Key
- Content Type
- File Size
- Upload Status
- Upload Started At
- Upload Completed At
- Original Message Deleted At
- Created At
- Error Code

使用狀態機管理：

Pending → Uploading → Uploaded → Completed

另需支援：

Cancelled / Expired / Failed / PartiallyCompleted

多附件上傳時，只有全部選定附件成功完成且替代連結訊息已送出，才允許刪除原始 Discord 訊息。

若部分附件失敗，保留原始訊息並顯示各檔案狀態，不可當作整批成功。

## 十、Audit Logs 與 Error Tracking 整合

PT-10 必須整合既有：

- PT-01 Advanced Audit Logs
- PT-05 System Monitoring
- PT-06 Owner Access Control
- PT-07 Module Management
- PT-08 Error Tracking
- PT-09 Web Dashboard

所有 R2 操作皆記錄事件。

由 PulseTools 主動刪除原始 Discord 訊息時，應關聯 Upload Request ID 與原始 Message ID，讓 Audit Logs 可識別這是授權上傳流程造成的刪除。

不得將自身產生的替代連結訊息再次觸發 R2 上傳流程。

## 十一、測試與驗收

至少測試：

1. 未設定的頻道不會觸發上傳詢問。
2. 設定頻道上傳圖片後會顯示選擇按鈕。
3. 非授權人員不可操作他人的上傳請求。
4. 選擇取消不會產生 R2 Object。
5. 選擇保留原訊息可以正常取得連結。
6. 選擇刪除原訊息，必須在上傳與替代訊息發送成功後才刪除。
7. R2 上傳失敗時不刪除 Discord 原始訊息。
8. 缺少 Manage Messages 權限時，不得執行刪除。
9. 多檔上傳部分失敗時保留原始訊息。
10. 重複點擊不會造成重複上傳。
11. 不同 Guild 的設定與紀錄完全隔離。
12. Dashboard 正確顯示檔案資訊和 Timestamp。
13. Windows 本地部署可正常連線 R2。
14. 不洩漏 R2 Access Key 或 Secret。
15. 對過期附件、網路中斷、重啟等情況有安全的失敗處理。

## 十二、開發要求

這是新增模組，不得重寫既有 PulseTools 架構。

沿用原有：

- TypeScript
- discord.js
- PostgreSQL
- Drizzle ORM
- Fastify
- React Dashboard
- Shared Embed Builder
- Permission Manager
- Module Manager
- Timestamp System

請先閱讀專案 AGENTS.md、既有模組介面與資料庫架構。

依照現有系統風格新增 PT-10。

先確認程式架構與預計修改的檔案，再進行實作。

不得自行修改原本九個模組的功能需求。

完成後提供測試結果、必要環境變數及 Cloudflare R2 Bucket 設定說明。
