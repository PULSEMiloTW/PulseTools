# PulseTools — Master Development Specification v1.1

## 0. Role & Mission

你是一名具有正式產品開發經驗的 Senior Full-Stack Engineer、Discord Bot Developer、Backend Architect、Database Engineer、Security Engineer 與 UI/UX Engineer。

你的任務是依照本文件，從零開始開發一套名為 **PulseTools** 的私人 Discord 多功能管理機器人。

PulseTools 隸屬於 **Pulse Studio**，定位為模組化、多伺服器、可長期維護及擴充的 Discord Management & Automation System。

這個專案不是概念展示、Prototype 或只有介面的 Mockup。

最終必須交付能夠在 Windows 本地環境真正啟動、連接 Discord、執行指令、儲存資料、管理多個 Guild 並提供 Web Dashboard 的完整系統。

請從專案架構、資料庫、Discord Bot、Backend API、Frontend Dashboard、模組系統、安全性及部署文件進行完整實作。

**所有使用者可見文字預設使用繁體中文（zh-TW）。**

請不要為了縮短開發時間而省略核心功能。

若工作目錄已有程式碼，必須先檢查既有架構並保留未提及的部分，禁止直接覆蓋或任意重構。

---

# 1. Project Overview

## 1.1 Basic Information

| Property | Value |
|---|---|
| Project Name | PulseTools |
| Organization | Pulse Studio |
| Application Type | Private Discord Bot |
| Architecture | Modular Monolith |
| Primary Language | TypeScript |
| Discord Framework | discord.js |
| Runtime | Node.js LTS |
| Backend Framework | Fastify |
| Dashboard Framework | React + Vite |
| Dashboard Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Authentication | Discord OAuth2 |
| Default Language | zh-TW |
| Default Timezone | Asia/Taipei |
| Initial Hosting | Local Windows |
| Brand Footer | Powered by Pulse Studio |

## 1.2 Expected Usage

預估規模：

- 約 5 個 Discord 伺服器。
- 成員人數不到 100 人的初期使用規模。
- 由單一 Owner 管理。
- 可授權其他 Discord 管理員執行指定功能。
- 不對外公開提供任意安裝服務。
- 只有在 Guild Allowlist 中的伺服器可以使用。

請針對這個規模合理設計。

不要導入不必要的 Kubernetes、微服務叢集、複雜分散式系統或大量外部依賴。

## 1.3 Design Philosophy

PulseTools 必須具備：

1. Modular — 模組化
2. Maintainable — 易於維護
3. Extensible — 易於擴充
4. Secure — 權限與資料安全
5. Persistent — 資料持久化
6. Observable — 可監控與追蹤
7. Multi-Guild — 多伺服器支援
8. Consistent — 統一訊息與介面設計
9. Portable — 可跨平台部署

---

# 2. Mandatory Development Rules

以下為不可忽略的開發規範。

## 2.1 程式架構

- 禁止將所有模組寫在單一大型檔案。
- 使用明確的模組介面。
- 共用功能必須抽象成 Core Services。
- 使用 TypeScript Strict Mode。
- 避免使用不必要的 any。
- 採用合理的錯誤處理、資料驗證及型別保護。
- 使用模組化事件處理架構。
- 避免重複建立相同功能的 Service。
- Dashboard 與 Slash Commands 必須共用相同的後端業務邏輯。
- 不得讓 Dashboard 直接連線資料庫。
- 不得硬編碼 Guild ID、User ID、Bot Token 或 Secret。

## 2.2 最小必要變更

如果專案已存在：

- 先閱讀 AGENTS.md。
- 先了解相關目錄及檔案。
- 只搜尋目前任務需要的程式碼。
- 不要無目的掃描整個 Repository。
- 不得修改未被要求的功能。
- 不得因為新增模組而重寫其他模組。
- 修改資料模型時必須提供 Migration。
- 完成修改後執行相關測試。

## 2.3 真實功能優先

禁止使用假資料冒充真實系統運作結果。

Dashboard 的 Overview、Logs、Guild Count、Uptime、Error Count 等資訊必須來自實際系統或資料庫。

開發階段可以使用明確標示為 Demo 的測試資料，但不能將其當作正式系統資料。

如果 Discord API 不支援某項功能，必須使用官方支援的替代方案，並清楚說明限制。

## 2.4 安全性

所有外部輸入都必須驗證。

所有敏感操作必須通過後端授權。

禁止將以下資訊寫入 Git：

- Discord Bot Token
- OAuth2 Client Secret
- Database Password
- Cloudflare R2 Access Key
- Cloudflare R2 Secret Key
- Session Secret
- Encryption Keys

所有機密均使用環境變數或安全的部署設定管理。

---

# 3. System Architecture

採用 Monorepo + Modular Monolith 架構。

建議專案結構：

PulseTools/

- apps/
  - bot/
  - api/
  - dashboard/

- packages/
  - core/
  - modules/
  - database/
  - shared/
  - embed-system/

- deploy/
  - windows/
  - docker/

- docs/
- tests/

- README.md
- AGENTS.md
- .env.example

允許依實際技術需求微調，但必須維持清楚的責任分離。

## 3.1 Bot Application

負責：

- Discord Gateway Connection
- Discord Events
- Slash Commands
- Interaction Components
- Bot Presence
- Event Dispatching
- Discord Message Delivery

## 3.2 Backend API

負責：

- Authentication
- Authorization
- Guild Management
- Module Configuration
- Audit Log Queries
- Moderation Services
- System Monitoring
- R2 File Services
- Dashboard Data API

## 3.3 Web Dashboard

負責：

- 顯示系統資訊
- Guild 切換
- 模組管理
- Logs 搜尋
- 管理員操作
- 通知設定
- R2 上傳紀錄
- 系統健康監控
- 錯誤追蹤

## 3.4 Database

PostgreSQL 作為唯一主要持久化資料來源。

所有 Guild 設定、管理案件、Logs、模組狀態、錯誤紀錄與 R2 上傳歷史均需持久化。

## 3.5 Core Services

建立共用服務：

- GuildManager
- ConfigurationManager
- PermissionManager
- ModuleManager
- EventRouter
- EmbedBuilder
- DatabaseService
- AuditLogService
- MessageCaptureService
- ModerationService
- HealthMonitor
- ErrorHandler
- TimestampService
- NotificationDeliveryService
- DataRetentionManager
- R2StorageService

不要在每個模組重複實作上述邏輯。

---

# 4. Module Architecture

PulseTools 必須包含以下 10 個模組：

| ID | Module |
|---|---|
| PT-01 | Advanced Audit Logs |
| PT-02 | Member Notifications |
| PT-03 | Configuration Center |
| PT-04 | Moderation Tools |
| PT-05 | System Monitoring |
| PT-06 | Owner Access Control |
| PT-07 | Module Management |
| PT-08 | Error Tracking |
| PT-09 | Web Dashboard |
| PT-10 | Cloudflare R2 File Management |

每個模組應具有：

- Module ID
- Name
- Version
- Description
- Enabled State
- Health State
- Dependencies
- Required Permissions
- Required Gateway Intents
- Configuration Schema
- Initialize Handler
- Shutdown Handler
- Event Handlers
- Slash Commands

模組狀態：

- Running
- Disabled
- Degraded
- Error
- Unavailable

各模組必須能獨立啟用或停用。

核心授權、資料庫、設定管理與錯誤捕捉等必要服務不應被一般模組開關停用。

---

# 5. Multi-Guild Architecture

必須從第一階段支援多個 Discord Guild。

## 5.1 Guild Allowlist

只有被 Owner 授權的 Guild 可以使用 PulseTools。

未授權 Guild：

- 不啟用業務功能。
- 不蒐集訊息原文。
- 不建立正常活動紀錄。
- 不提供管理服務。
- 不允許存取 Guild 專屬 Dashboard 資料。

Owner 必須可以新增、查看及撤銷 Guild 授權。

## 5.2 Guild Isolation

所有 Guild 相關資料都必須具備 guild_id。

包含：

- Notification Settings
- Audit Logs
- Message Snapshots
- Module States
- Moderation Cases
- Guild Administrators
- R2 Upload Settings
- R2 Upload Records
- Retention Policies

每個 Guild 可設定不同的頻道與功能。

不同 Guild 的資料絕對不可混用。

## 5.3 Authorization

所有權限驗證至少考慮：

- Discord User ID
- Guild ID
- PulseTools Internal Role
- Discord Native Permissions
- Target Member Role Hierarchy

所有敏感查詢及操作必須在 Backend 進行驗證。

---

# 6. Unified Discord Embed Design System

所有 PulseTools 主動發送的通知、Logs、指令結果及系統錯誤，統一使用 Discord Embed。

## 6.1 Visual Identity

- Bot Name：PulseTools
- Brand：Pulse Studio
- Language：繁體中文
- Footer：Powered by Pulse Studio
- Timestamp：Discord Native Timestamp
- Layout：Discord Native Embed
- Member Thumbnail：優先顯示成員頭像

依照使用者提供的 Discord 通知參考圖，保留簡潔、整齊、具識別性的事件紀錄風格。

## 6.2 Embed Colors

- Member Join：#10B981
- Member Leave：#F87171
- Voice Events：#8B5CF6
- Moderation：#F59E0B
- System Information：#3B82F6
- Error：#EF4444
- R2 Upload：#3B82F6
- R2 Upload Success：#10B981
- R2 Upload Failure：#EF4444

建立統一 Theme Configuration。

不得讓各模組自行硬編碼不同的 Embed 樣式。

## 6.3 Formatting

每則 Embed 至少具備：

- Event Title
- Event Content
- Relevant Entity Information
- Footer
- Timestamp

必要時加入：

- User Avatar
- Guild Name
- Channel Name
- User ID
- Event ID
- Error ID
- Case ID

使用者提供的文字必須避免意外觸發 @everyone、@here 或身分組提及。

必須遵守 Discord Embed 長度限制。

## 6.4 Branding Rules

所有品牌文字統一為：

PulseTools

Powered by Pulse Studio

禁止使用：

- PulseCore
- Powered by Pulse Studuo

---

# 7. PT-01 — Advanced Audit Logs

建立完整的 Discord 伺服器事件紀錄系統。

## 7.1 Event Categories

### Member Logs

- Member Join
- Member Leave
- Nickname Update
- Member Role Add
- Member Role Remove

### Message Logs

- Message Update
- Message Delete
- Message Bulk Delete
- Message Snapshot Capture

### Voice Logs

- Voice Join
- Voice Leave
- Voice Channel Switch

### Channel Logs

- Channel Create
- Channel Delete
- Channel Update
- Permission Overwrite Changes

### Role Logs

- Role Create
- Role Delete
- Role Update
- Role Permission Changes

### Moderation Logs

- Warning
- Timeout
- Timeout Removal
- Kick
- Ban
- Unban

### Server Logs

- Guild Configuration Changes
- Invite Events
- Other Supported Administrative Events

所有事件類型必須可獨立啟用及停用。

## 7.2 Log Channel Routing

每個 Guild 可以將不同事件發送到不同頻道。

例如：

- Member Logs → 成員紀錄頻道
- Message Logs → 訊息紀錄頻道
- Voice Logs → 語音紀錄頻道
- Moderation Logs → 管理紀錄頻道

頻道設定必須持久化。

如果目標頻道被刪除或 Bot 無權發送訊息，必須建立錯誤紀錄。

## 7.3 Message Content Logging

支援保存可取得的原始訊息內容。

建立：

- Message Snapshot
- Message Version History
- Message Edit History
- Message Delete History

保存：

- Message ID
- Guild ID
- Channel ID
- Author ID
- Original Content
- Captured Versions
- Created At
- Edited At
- Deleted At
- Capture Status

Capture Status：

- Captured
- Partial
- Unavailable

當訊息編輯時：

記錄已取得的編輯前後內容。

當訊息刪除時：

優先使用事先保存的 Snapshot。

如果原始內容不存在，不得自行推測。

## 7.4 Content Capture Policy

原文紀錄必須支援：

- Guild 開關
- Channel Allowlist
- Channel Exclusion
- Retention Period
- Authorized Viewer Permissions
- Privacy Notice

新的 Guild 預設不啟用原文保存，直到管理者明確設定。

預設建議保存 30 天，允許每個 Guild 獨立修改。

DM 不納入本模組。

不得將訊息原文直接寫入普通 Debug Logs。

## 7.5 Audit Attribution

Discord Audit Log 並不保證所有事件都存在操作者資訊。

若能可靠關聯事件與執行者則記錄。

如果無法確認，顯示：

無法確認

不可將推測當成事實。

## 7.6 Reliability

必須具備：

- Event Deduplication
- Queue Processing
- Retry Policy
- Rate Limit Handling
- Error Recording
- Missing Data Handling
- Message Delivery Tracking

Slash Commands：

- /logs status
- /logs channel set
- /logs channel list
- /logs event set
- /logs recent
- /logs retention set
- /logs test

---

# 8. PT-02 — Member Notifications

建立成員加入／離開通知。

## 8.1 Member Join

Embed Title：

成員加入

內容：

👋 歡迎加入【伺服器名稱】！

成員：@Username

目前成員總人數：65

Thumbnail：Member Avatar

Footer：Powered by Pulse Studio

## 8.2 Member Leave

Embed Title：

成員離開

內容：

👋 成員已離開【伺服器名稱】

成員：Username

目前成員總人數：64

Thumbnail：Member Avatar

Footer：Powered by Pulse Studio

## 8.3 Features

- Independent Join Channel
- Independent Leave Channel
- Member Avatar
- Member ID
- Guild Name
- Member Count
- Optional Account Creation Date
- Customizable Message Content
- Module Toggle
- Embed Preview
- Test Notification

如果無法確定成員離開原因，不得推斷其為 Kick、Ban 或自行退出。

Slash Commands：

- /welcome status
- /welcome channel set
- /welcome message set
- /welcome toggle
- /welcome test

---

# 9. PT-03 — Configuration Center

建立全系統設定管理中心。

支援：

- Initial Setup
- Global Settings
- Guild Settings
- Channel Configuration
- Module Configuration
- Configuration Validation
- Configuration History
- Import / Export
- Reset

所有設定儲存於資料庫。

修改設定後應立即生效，不需要重新啟動 Bot。

Initial Setup 需檢查：

- Guild Authorization
- Bot Permissions
- Required Gateway Intents
- Database Connection
- Configured Channels
- Module Dependencies

Slash Commands：

- /pulse setup
- /config view
- /config channel
- /config timezone
- /config language
- /config export
- /config reset
- /config guild status
- /config guild overview

重設設定需要確認。

匯出設定不得包含任何 Secret。

---

# 10. PT-04 — Moderation Tools

建立 Discord 管理員工具。

## 10.1 Features

- Warn
- Timeout
- Remove Timeout
- Kick
- Ban
- Unban
- Message Purge
- Moderation History
- Case Notes

## 10.2 Moderation Cases

每次管理操作產生獨立 Case ID。

至少保存：

- Case ID
- Guild ID
- Target User ID
- Moderator User ID
- Action Type
- Reason
- Action Status
- Created At
- Related Case ID

操作失敗不得記錄成成功。

解除處分時建立關聯紀錄，不得覆蓋原始案件。

## 10.3 Permissions

執行前必須確認：

- PulseTools Internal Permission
- Discord Native Permission
- Bot Permission
- Role Hierarchy
- Valid Target
- Valid Duration
- Required Confirmation

遵守 Discord Timeout 與訊息批次刪除限制。

Slash Commands：

- /mod warn
- /mod timeout
- /mod untimeout
- /mod kick
- /mod ban
- /mod unban
- /mod history
- /mod purge
- /mod note

---

# 11. PT-05 — System Monitoring

建立系統健康監測功能。

## 11.1 Metrics

至少包含：

- Bot Status
- Gateway Ping
- API Latency
- Uptime
- Started At
- CPU Usage
- Memory Usage
- Guild Count
- Authorized Guild Count
- Active Module Count
- Database Health
- Error Count
- Notification Delivery Status

## 11.2 Discord Bot Presence

Bot 正常運作時設定：

Status：Online

Activity Text：

Powered by Pulse Studio

啟動後自動設定。

Gateway 重連後恢復狀態。

只能使用 Discord 官方允許的 Bot Presence 欄位。

若特定 Activity 類型會自動加上 Playing、Watching 等前綴，選擇最接近需求且受官方支援的呈現方式，不得宣稱可以繞過 Discord 限制。

## 11.3 Detailed Status

提供：

/system status

回傳 Embed，至少顯示：

- PulseTools
- Online / Degraded
- Uptime
- Guild Count
- Gateway Ping
- Active Modules
- Started At
- Version

Uptime 從本次 Bot 程序實際啟動時間計算。

Guild Count 顯示實際已加入的伺服器數量。

由於普通 Bot Presence 不支援任意自訂的展開資訊卡，因此另外提供詳細狀態 Embed。

可以在授權的系統訊息中增加「查看狀態」按鈕，點擊後回傳最新系統資訊。

## 11.4 Commands

- /system status
- /system ping
- /system uptime
- /system modules
- /system diagnostics

---

# 12. PT-06 — Owner Access Control

建立分級權限系統。

## 12.1 Permission Levels

L0 — Owner

- Global Administration
- Guild Allowlist
- User Authorization
- Module Management
- Global Configuration
- System Diagnostics

L1 — Authorized Admin

- Guild Configuration
- Guild Logs
- Guild Module Management
- Authorized Moderation

L2 — Moderator

- Authorized Moderation
- Moderation Case Access

L3 — Member

- No Administrative Permission by Default

## 12.2 Owner Configuration

Owner Discord User ID 由環境變數指定。

一般 Guild Administrator 不自動取得 PulseTools Owner 權限。

任何操作均需進行伺服器端授權驗證。

## 12.3 Owner Lockdown

提供緊急安全模式。

啟用後：

- 暫停高風險操作。
- 保留 Owner 指令。
- 保留必要診斷能力。
- 保留安全復原流程。

Commands：

- /owner status
- /owner operator add
- /owner operator remove
- /owner guild list
- /owner guild allow
- /owner guild deny
- /owner lockdown

---

# 13. PT-07 — Module Management

建立模組啟用與停用系統。

所有 Guild 可以擁有不同模組設定。

提供：

- Module List
- Module Information
- Enable
- Disable
- Health Check
- Dependency Check

Commands：

- /module list
- /module info
- /module enable
- /module disable
- /module health

停用模組時：

- 停止新的業務事件處理。
- 保留既有設定。
- 保留依法定或系統保存政策管理的歷史紀錄。
- 不影響其他模組。

避免事件監聽器重複註冊。

---

# 14. PT-08 — Error Tracking

建立錯誤紀錄與異常通知系統。

## 14.1 Error Types

- Command Error
- Permission Error
- API Error
- Database Error
- Module Error
- Gateway Error
- Dashboard Error
- Configuration Error
- R2 Upload Error

## 14.2 Error Information

每筆錯誤至少包含：

- Error ID
- Module ID
- Guild ID（若適用）
- Error Type
- Error Code
- Summary
- Occurred At
- Received At
- Status

完整 Stack Trace 僅允許授權管理者存取。

## 14.3 Features

- Error Logging
- Error Notification
- Error Aggregation
- Error Acknowledge
- Error Statistics
- Duplicate Error Suppression

避免相同錯誤在短時間大量發送通知。

Commands：

- /error list
- /error detail
- /error stats
- /error acknowledge

所有錯誤訊息採用統一 Embed Design System。

---

# 15. PT-09 — Web Dashboard

建立完整的 PulseTools 管理後台。

## 15.1 UI Design

採用現代化 SaaS Dashboard 風格。

設計原則：

- Dark Mode First
- Professional
- Minimal
- Responsive
- Clean Typography
- Consistent Spacing
- Sidebar Navigation
- Top Header
- Guild Switcher
- Status Cards
- Searchable Data Tables
- Timestamp Display
- Pulse Studio Branding

不要設計過度花俏的動畫或不必要的視覺特效。

## 15.2 Pages

### Overview

顯示：

- Bot Online Status
- Uptime
- Guild Count
- Active Modules
- Gateway Ping
- Recent Events
- Recent Errors

所有數值使用真實系統資料。

### Servers

- Authorized Guild List
- Guild Switcher
- Guild Status
- Guild Settings

### Audit Logs

- Event List
- Event Type Filter
- Guild Filter
- User Filter
- Channel Filter
- Time Range Filter
- Event Detail
- Message Original Content
- Message Version Comparison

### Members

- Member Information
- Moderation History

### Moderation

- Case List
- Case Details
- Authorized Actions

### Notifications

- Join Notification Settings
- Leave Notification Settings
- Channel Configuration
- Embed Preview

### Modules

- Module List
- Module Status
- Enable / Disable
- Dependencies

### System Health

- CPU
- Memory
- Uptime
- Database Health
- Gateway Latency
- Health History

### Error Center

- Error List
- Error Details
- Acknowledgement

### Cloud Storage

- R2 Upload History
- File Information
- File URL
- Upload Status
- Original Message Status
- Timestamp
- Guild Settings

### Settings

- Global Configuration
- Guild Configuration
- Retention Configuration
- Configuration History

### Access Control

- Authorized Users
- Internal Roles
- Guild Permissions

## 15.3 Authentication

使用 Discord OAuth2 Authorization Code Flow。

實作：

- State Validation
- Secure Sessions
- HttpOnly Cookies
- SameSite Cookies
- CSRF Protection
- Session Expiration
- Logout
- Backend Authorization

登入成功不代表具備管理權限。

所有 API 均需要後端權限檢查。

初期 Dashboard 只需支援 Windows 本機存取。

預設使用 127.0.0.1。

不得直接公開管理 API。

---

# 16. Global Timestamp System

這是強制規格。

**Web Dashboard 中每一筆事件都必須顯示 Timestamp。**

適用於：

- Member Events
- Voice Events
- Message Events
- Moderation Events
- Channel Events
- Role Events
- Configuration Changes
- Module Events
- Errors
- R2 Upload Events
- System Events

## 16.1 Database Time

資料庫統一使用 UTC。

建議欄位：

- event_at
- received_at
- processed_at
- timestamp_source

若 Discord Event 提供可靠時間，優先使用該時間。

若無可靠事件時間，使用接收時間並標示來源。

不得偽造精確的事件發生時間。

## 16.2 Dashboard Display

預設：

Asia/Taipei

格式：

YYYY/MM/DD HH:mm:ss

詳細資訊支援毫秒精度。

必須支援：

- Time Sorting
- Time Range Filtering
- Timestamp Detail
- Timezone Conversion

Discord Embed 使用 Discord Native Timestamp。

---

# 17. PT-10 — Cloudflare R2 File Management

這是 PulseTools 的第十個正式模組。

建立 Discord 指定頻道檔案上傳與 Cloudflare R2 整合功能。

## 17.1 Core Workflow

當使用者在指定 Discord 頻道上傳圖片或檔案時：

1. PulseTools 偵測新訊息中的附件。
2. 確認 Guild 與 Channel 已啟用 R2 模組。
3. 確認附件符合允許格式及大小限制。
4. 使用 Embed 回覆該訊息。
5. 詢問是否上傳至 Cloudflare R2。
6. 使用者選擇處理方式。
7. Bot 依選項執行上傳。
8. 驗證上傳是否成功。
9. 回傳檔案連結及資訊。
10. 依選項決定是否刪除原始 Discord 訊息。
11. 記錄完整事件及 Timestamp。

**使用者確認之前，禁止自動將附件內容上傳到 R2。**

## 17.2 Discord Interaction UI

Bot 發送 Embed：

Title：

雲端檔案上傳

Description：

偵測到新的檔案附件，是否要上傳至 Cloudflare R2 雲端儲存空間？

顯示：

- Uploader
- Filename
- File Type
- File Size
- Attachment Count

Footer：

Powered by Pulse Studio

提供三個 Discord Buttons：

1. 上傳並保留原訊息
2. 上傳並刪除原訊息
3. 取消上傳

只有以下使用者能操作：

- 原始附件上傳者。
- 經明確授權的管理員。

其他使用者按下時，應使用 Ephemeral Message 提示沒有權限。

## 17.3 Upload Confirmation

按下確認後：

- 驗證 Request ID。
- 驗證操作權限。
- 驗證 Guild 與 Channel。
- 驗證原始訊息是否仍存在。
- 驗證附件是否仍可取得。
- 驗證請求尚未完成。
- 驗證 R2 連線設定。

同一請求不得因重複點擊而重複上傳。

使用持久化的 Upload Request 狀態管理。

若確認訊息過期，應停用操作並提示重新上傳。

預設操作有效期限為五分鐘，可設定。

## 17.4 Cloudflare R2 Integration

使用 Cloudflare R2 S3-Compatible API。

建議使用：

AWS SDK for JavaScript v3

必要環境變數：

- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME
- R2_PUBLIC_BASE_URL（可選）

憑證必須儲存在安全環境變數中。

不得將 R2 Secret 暴露至 Dashboard 前端。

R2 Token 採最小必要權限。

## 17.5 File Validation

必須支援：

- Allowed File Extensions
- MIME Type Verification
- Content Inspection
- Max File Size
- Max Attachment Count
- Filename Sanitization
- Safe Object Key Generation
- Duplicate Prevention
- Streaming Upload
- Upload Timeout
- Upload Retry
- Temporary Resource Cleanup

初期優先支援：

- PNG
- JPG
- JPEG
- WEBP
- GIF

其他檔案類型由管理員透過白名單設定開放。

不得僅依賴檔案副檔名判斷格式。

應避免不受限制的記憶體緩衝及檔案下載。

只接受經 Discord Attachment 資料驗證的來源，處理 HTTP Redirect 時必須重新驗證來源並防止 SSRF。

## 17.6 Object Key Structure

建議使用：

guild_id/year/month/unique_id-filename

例如：

123456789/2026/10/uuid-image.png

需要保留原始檔名 Metadata。

不同檔案不得互相覆蓋。

## 17.7 R2 Link Modes

必須支援兩種模式。

### Public Mode

使用已設定的 Cloudflare R2 Custom Domain 提供公開連結。

公開 URL 必須可實際存取。

不得將 R2 S3 API Endpoint 假裝成公開網址。

若未設定可用的公開網域，應清楚回報設定不足。

### Private Mode

R2 Bucket 維持私人狀態。

使用具有效期限的 Presigned GET URL 或受授權的下載服務。

Presigned URL 不得宣稱永久有效。

如果連結會過期，必須向使用者顯示有效期限。

如果使用者選擇刪除 Discord 原始訊息，預設必須先具備可持續使用的檔案存取方式，例如公開自訂網域或有權限驗證的穩定下載入口。

如果只有短期有效的 Presigned URL，且無持續存取方案，預設禁止「上傳並刪除原訊息」，避免原始附件刪除後只剩失效連結。

## 17.8 Original Message Deletion

這是本模組的重要功能。

使用者可以選擇：

- 保留原始 Discord 訊息。
- 上傳成功後刪除原始 Discord 訊息。

若選擇刪除：

1. 完成 R2 上傳。
2. 驗證所有檔案已成功儲存。
3. 確認取得可使用的檔案連結。
4. 發送包含 R2 連結的替代訊息。
5. 確認替代訊息發送成功。
6. 驗證 Bot 具有 Manage Messages 權限。
7. 刪除原始 Discord 訊息。
8. 更新資料庫狀態。

刪除其他使用者的 Discord 訊息需要對應權限。

不得嘗試直接修改其他使用者的訊息附件。

若原始訊息包含文字，刪除時也會一併移除。

替代訊息僅需保留必要的檔案資訊、上傳者識別及 R2 連結。

## 17.9 Failure Handling

以下情況不得刪除原始訊息：

- R2 Upload Failed
- Upload Verification Failed
- Attachment Unavailable
- Invalid File Type
- File Size Exceeded
- Missing Permissions
- Replacement Message Failed
- No Durable Download Link

如果替代訊息發送成功，但原始訊息刪除失敗：

- 保留原始訊息。
- 記錄 PartiallyCompleted。
- 提示管理員或操作人員。
- 不得回報整個刪除流程成功。

## 17.10 Multiple Attachments

一則 Discord 訊息可能包含多個附件。

需要支援多附件上傳。

每個附件應有獨立上傳狀態。

如果部分附件失敗：

- 保留原始訊息。
- 回報每個附件的處理結果。
- 不得將整批操作標記為成功。

只有全部選定附件成功且替代訊息發送成功後，才可以執行原訊息刪除。

## 17.11 Upload States

建立狀態：

- Pending
- Uploading
- Uploaded
- Completed
- Cancelled
- Expired
- Failed
- PartiallyCompleted

狀態變更必須持久化。

支援服務重啟後辨識未完成請求。

對失敗或中斷的請求採取安全復原策略。

## 17.12 Guild Configuration

每個 Guild 可以設定：

- Module Enabled
- Upload Channel IDs
- Allowed File Types
- Max File Size
- Max Files Per Message
- R2 Object Prefix
- Upload Permissions
- Original Message Deletion Policy
- Public / Private Mode
- Prompt Timeout
- Upload Result Channel

預設不監聽未設定的頻道。

R2 全域憑證只有 Owner 可以設定。

## 17.13 Dashboard Integration

在 Dashboard 建立：

Cloud Storage

顯示：

- Filename
- File Type
- File Size
- Guild
- Channel
- Uploader
- Object Key
- File URL
- Upload Status
- Original Message Status
- Uploaded At
- Original Deleted At
- Error Details

支援：

- Filename Search
- Guild Filter
- Uploader Filter
- Status Filter
- Time Range Filter

所有紀錄必須顯示 Timestamp。

## 17.14 Slash Commands

- /r2 status
- /r2 channel add
- /r2 channel remove
- /r2 channel list
- /r2 config
- /r2 files
- /r2 file info
- /r2 test

指令需使用完整的權限驗證。

## 17.15 Integration

PT-10 必須整合：

- Audit Logs
- Permission Manager
- Module Manager
- Error Tracking
- System Monitoring
- Dashboard
- Timestamp Service

由 PulseTools 上傳流程刪除的原始訊息應關聯 Upload Request ID。

Audit Logs 必須能辨識該刪除事件與 R2 上傳操作的關聯。

Bot 自己產生的替代連結訊息不可再次觸發 R2 上傳詢問。

---

# 18. Database Architecture

使用 PostgreSQL + Drizzle ORM。

至少包含以下資料表：

## Core

- guilds
- guild_settings
- guild_access_grants
- module_states
- event_routes
- config_revisions

## Audit

- audit_events
- message_snapshots
- message_versions
- message_events
- content_capture_policies
- retention_policies

## Moderation

- moderation_cases

## Monitoring

- health_samples
- error_events
- delivery_jobs

## Security

- audit_access_logs
- privacy_requests

## Cloudflare R2

- r2_guild_settings
- r2_upload_requests
- r2_uploaded_objects
- r2_upload_events

必須建立：

- Primary Keys
- Foreign Keys
- Unique Constraints
- Indexes
- Transactions
- Database Migrations
- Data Validation

Guild 專屬資料必須以 guild_id 隔離。

訊息原文應具備適當的靜態加密與存取控制。

設定、事件與檔案紀錄不能因 Bot 重啟而消失。

資料清理與備份需有合理的保存期限。

---

# 19. Windows Local Hosting

初期正式部署環境為 Windows。

不需要立即購買 VPS。

## 19.1 Local Environment

請支援：

- Node.js LTS
- PostgreSQL
- Windows Terminal / PowerShell
- Environment Variables
- Local Dashboard
- Discord Bot Process

提供簡單明確的初始化流程。

## 19.2 Startup

開發時可以透過終端機啟動。

正式部署需要提供 Windows 自動啟動方案。

可以使用：

- Windows Task Scheduler
- Appropriate Process Manager
- Optional Windows Service

必須支援：

- Auto Start
- Crash Recovery
- Graceful Shutdown
- Persistent Logs
- Duplicate Process Prevention

未經使用者確認，不得直接安裝 Windows Service、修改防火牆或變更系統設定。

## 19.3 Dashboard Access

預設綁定：

127.0.0.1

不公開對外存取。

初期不需要 Port Forwarding。

## 19.4 Future VPS Migration

保留：

- Linux Compatibility
- Docker Compose Configuration
- Environment-Based Configuration
- Database Export / Import
- Persistent Storage Configuration

不得讓主要業務邏輯依賴 Windows 專用 API。

---

# 20. System Security

所有模組均需實作必要安全措施。

至少包含：

- Owner Authorization
- Guild Authorization
- Discord Permission Validation
- Role Hierarchy Check
- OAuth2 Authentication
- Secure Session Management
- CSRF Protection
- API Input Validation
- API Rate Limiting
- Sensitive Data Redaction
- Secure Configuration
- Audit Access History
- Message Retention
- Data Deletion Support
- R2 Credential Protection
- R2 File Validation
- Safe File Download
- File Upload Idempotency

任何使用者不得藉由修改 API Request、Guild ID 或 URL 取得未授權資料。

禁止將 Bot Token、R2 Secret 或資料庫憑證傳送到前端。

敏感操作預設使用 Discord Ephemeral 回覆。

---

# 21. Error Handling & Reliability

建立統一的 Error Handling Policy。

## 21.1 Discord

支援：

- Gateway Reconnection
- REST API Error Handling
- Rate Limit Compliance
- Interaction Timeout Handling
- Command Failure Handling

## 21.2 Database

支援：

- Connection Failure
- Query Failure
- Transaction Rollback
- Migration Error Reporting

## 21.3 Cloudflare R2

支援：

- Connection Timeout
- Authentication Failure
- Upload Failure
- File Validation Failure
- Partial Upload Failure
- Duplicate Request Handling
- Temporary File Cleanup

## 21.4 Notification Delivery

必須：

- 避免無限重試。
- 遵守 Discord Rate Limits。
- 記錄失敗原因。
- 避免同一事件重複發送。
- 對短時間大量事件提供佇列處理。

單一模組錯誤不得導致其他模組停止運作。

---

# 22. Development Phases

請採用階段式開發。

## Phase 1 — Project Foundation

建立：

- Monorepo
- TypeScript
- Discord Bot Core
- PostgreSQL
- Drizzle ORM
- Environment Configuration
- Multi-Guild Allowlist
- Owner Permission System
- Module System
- Shared Embed Builder

驗收：

- Windows 可以成功啟動。
- Discord Bot 成功連線。
- 基本 Slash Commands 可執行。
- 至少兩個測試 Guild 的設定互相隔離。
- 資料庫設定可持久化。

## Phase 2 — Audit Infrastructure

建立：

- Event Router
- Message Snapshot
- Message Version History
- Audit Event Storage
- Timestamp Service
- Event Deduplication
- Data Retention

驗收：

- 訊息可在指定範圍內保存原文。
- 可以記錄編輯版本。
- 刪除事件能使用已保存 Snapshot。
- 缺少原文時正確標示 Unavailable。
- Guild 資料互相隔離。

## Phase 3 — Member & Server Events

建立：

- Member Join / Leave
- Voice Logs
- Message Logs
- Role Logs
- Channel Logs
- Event Routing

驗收：

- Embed 樣式統一。
- Footer 正確。
- Timestamp 正確。
- 各事件發送到對應頻道。

## Phase 4 — Moderation & Core Management

建立：

- Moderation Tools
- Moderation Cases
- Module Management
- System Monitoring
- Error Tracking
- Owner Lockdown

驗收：

- 權限不足時拒絕操作。
- 管理紀錄正確保存。
- 模組可獨立開關。
- Uptime 正確。
- Guild Count 正確。
- Presence 顯示 Powered by Pulse Studio。

## Phase 5 — Cloudflare R2 Module

建立：

- R2 Client
- Attachment Detection
- Interactive Upload Prompt
- Upload Confirmation
- R2 Object Storage
- Link Generation
- Optional Original Message Deletion
- Multi-Attachment Support
- Upload History

驗收：

- 指定頻道上傳附件會觸發詢問。
- 可選擇上傳並保留原訊息。
- 可選擇上傳並刪除原訊息。
- 取消不會上傳。
- 上傳失敗不會刪除原訊息。
- 缺少刪除權限時不會強行操作。
- 重複點擊不會重複上傳。
- R2 Object 與資料庫紀錄一致。

## Phase 6 — Web Dashboard

建立：

- React Dashboard
- Fastify API
- Discord OAuth2
- Guild Switcher
- Overview
- Audit Logs
- Moderation
- Notifications
- Modules
- System Health
- Error Center
- Cloud Storage
- Access Control

驗收：

- Owner 可以登入。
- 可以切換 Guild。
- 各 Guild 設定互相隔離。
- Dashboard 可查看真實 Logs。
- 所有事件具備 Timestamp。
- 可以管理 R2 設定與查看上傳歷史。
- 未授權者無法存取敏感資訊。

## Phase 7 — Production Readiness

完成：

- Unit Tests
- Integration Tests
- Permission Tests
- Guild Isolation Tests
- Error Recovery Tests
- Windows Startup
- Database Backup / Restore
- Documentation
- Deployment Validation

驗收：

- 所有模組可共同運作。
- 重啟不遺失設定。
- 事件不會無故重複。
- 權限系統正常。
- R2 上傳與刪除流程安全。
- Windows 能正常啟動與關閉系統。
- 專案具備完整維護文件。

---

# 23. Testing Requirements

至少建立：

- Owner Authorization Tests
- Guild Isolation Tests
- Module State Tests
- Embed Builder Tests
- Member Event Tests
- Message Snapshot Tests
- Message Version Tests
- Audit Log Tests
- Timestamp Conversion Tests
- Moderation Permission Tests
- Discord API Failure Tests
- Database Persistence Tests
- OAuth2 Tests
- Dashboard API Authorization Tests
- R2 Upload Tests
- R2 Failure Tests
- Original Message Deletion Tests
- Multiple Attachment Tests
- Duplicate Upload Prevention Tests
- Error Recovery Tests

使用 Mock 驗證可離線測試的邏輯。

真實 Discord API 整合測試應另外執行。

涉及真實 Kick、Ban、刪除訊息或上傳實際檔案等操作，必須先取得使用者同意，並限定於明確的測試環境。

---

# 24. Documentation

請建立：

- README.md
- AGENTS.md
- .env.example

docs/：

- REQUIREMENTS.md
- ARCHITECTURE.md
- MODULES.md
- DATABASE.md
- PERMISSIONS.md
- COMMANDS.md
- EMBED_DESIGN.md
- DASHBOARD.md
- R2_STORAGE.md
- WINDOWS_SETUP.md
- DEPLOYMENT.md
- SECURITY.md
- TESTING.md

文件需使用繁體中文，必要的技術名詞可保留英文。

## 24.1 AGENTS.md

請在 AGENTS.md 明確規定：

- 遵守最小必要變更。
- 不要無目的掃描整個 Repository。
- 不得擅自新增大型功能。
- 不得破壞既有模組。
- 不得將機密提交至 Git。
- 資料庫異動必須使用 Migration。
- 修改功能後必須執行相關測試。
- 必須遵守 Embed Design System。
- 必須遵守 Guild Data Isolation。
- 必須遵守 Timestamp System。
- 必須保持 Windows / Linux 相容。
- 不得使用虛假資料冒充正式執行結果。

---

# 25. Required Environment Configuration

請提供完整的 .env.example。

至少包含以下必要或選用設定。

## Discord

- DISCORD_BOT_TOKEN
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_OWNER_ID

## Database

- DATABASE_URL

## Backend

- API_HOST
- API_PORT
- SESSION_SECRET

## OAuth2

- DISCORD_REDIRECT_URI

## R2

- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME
- R2_PUBLIC_BASE_URL

## Application

- NODE_ENV
- TZ
- LOG_LEVEL

請依實際需要補充其他設定。

不得在範例中放入真實憑證。

缺少必要設定時，提供明確的錯誤訊息。

非核心模組的選用設定缺失時，不得使整個 Bot 無法啟動；應停用對應功能並顯示設定需求。

---

# 26. Official API References

開發時請優先參考最新官方文件。

Discord：

https://docs.discord.com/developers/

Discord Gateway：

https://docs.discord.com/developers/events/gateway

Discord Gateway Events：

https://docs.discord.com/developers/events/gateway-events

Discord Application Commands：

https://docs.discord.com/developers/interactions/application-commands

Discord OAuth2：

https://docs.discord.com/developers/topics/oauth2

Discord Message Resource：

https://docs.discord.com/developers/resources/message

Cloudflare R2：

https://developers.cloudflare.com/r2/

Cloudflare R2 S3 API：

https://developers.cloudflare.com/r2/get-started/s3/

Cloudflare R2 Public Buckets：

https://developers.cloudflare.com/r2/buckets/public-buckets/

Cloudflare R2 Presigned URLs：

https://developers.cloudflare.com/r2/api/s3/presigned-urls/

若官方 API、框架版本或平台規範有所變更，請使用目前穩定且受支援的實作方式。

不得使用不受支援的 Discord Self-Bot 或非官方客戶端修改方式。

---

# 27. Deliverables

專案完成後必須交付：

1. 完整 PulseTools 原始碼。
2. 可啟動的 Discord Bot。
3. 10 個完整功能模組。
4. PostgreSQL 資料庫架構。
5. Database Migrations。
6. Discord Slash Commands。
7. 統一 Embed Design System。
8. Discord Bot Presence。
9. Multi-Guild Support。
10. Owner Permission System。
11. Audit Logs 與訊息原文保存。
12. 成員加入／離開通知。
13. Moderation Tools。
14. Monitoring & Error Tracking。
15. Cloudflare R2 上傳管理。
16. 選擇性刪除 Discord 原始上傳訊息。
17. 完整 Web Dashboard。
18. Discord OAuth2 登入。
19. 全事件 Timestamp。
20. Windows 安裝與部署文件。
21. 自動啟動及備份方案。
22. 測試與驗收結果。
23. 未來 Linux / VPS 遷移指引。

所有功能均需真正連接對應服務，不得使用純 Mockup 充當完成品。

---

# 28. Execution Instructions

請依照以下工作方式執行。

## Step 1 — Workspace Inspection

先檢查目前工作目錄。

如果是空白專案，建立合理的專案基礎。

如果已有專案，先閱讀 AGENTS.md、README.md 與相關原始碼。

不得直接覆蓋既有程式。

## Step 2 — Development Plan

建立完整的開發階段計畫。

列出：

- Phase
- Tasks
- Dependencies
- Acceptance Criteria
- Risks

請將計畫保存為專案文件。

## Step 3 — Implementation

按照 Phase 1 至 Phase 7 進行開發。

每個階段都必須包含：

- Implementation
- Validation
- Testing
- Documentation Update

不要跳過核心功能直接建立漂亮但無法使用的 Dashboard。

## Step 4 — Verification

每個 Phase 完成時，必須：

1. 列出已完成的功能。
2. 列出新增或修改的檔案。
3. 列出執行過的測試。
4. 顯示測試結果。
5. 說明未完成項目。
6. 說明是否通過階段驗收。

不允許將尚未測試的功能宣稱為正式完成。

如果驗收失敗，先修正該階段問題，再進入下一階段。

## Step 5 — User Intervention

如果需要：

- Discord Bot Token
- Discord Application ID
- Discord OAuth2 Secret
- Owner Discord User ID
- Database Credentials
- Cloudflare R2 Credentials
- Cloudflare R2 Bucket
- Custom Domain
- 系統管理員權限
- 建立 Windows Service
- 公開網路服務
- 真實 Discord 管理操作

請明確說明使用者需要做什麼。

不得自行猜測機密。

不得使用假的 Token 假裝完成連線。

未經使用者確認，不要執行會變更真實 Discord 成員狀態、刪除訊息、公開敏感資料或修改 Windows 系統服務的操作。

## Step 6 — Final Delivery

完成後提供：

- 完整系統架構摘要
- 功能模組清單
- Slash Commands 清單
- Windows 啟動方式
- Dashboard 存取方式
- Discord Bot 初始化方式
- PostgreSQL 初始化方式
- Cloudflare R2 設定方式
- 測試結果
- 備份及復原方式
- 已知限制
- 未來維護及擴充方式

---

# 29. Final Product Expectations

最終的 PulseTools 必須具備以下特性：

- 一個可正常運作的私人 Discord Bot。
- 可管理多個經授權的 Discord Guild。
- 所有模組採取一致的架構。
- 所有 Discord Embed 採統一品牌視覺。
- Bot 狀態顯示 Powered by Pulse Studio。
- 所有 Embed Footer 顯示 Powered by Pulse Studio。
- 可記錄成員加入／離開。
- 可記錄語音活動。
- 可記錄訊息編輯及刪除。
- 可保存可取得的訊息原文與版本。
- 可記錄伺服器管理事件。
- 可執行管理員工具。
- 可管理 Owner 與授權人員。
- 可獨立開關功能模組。
- 可查看 Bot Uptime 與 Guild Count。
- 可記錄系統錯誤及異常。
- 擁有真正可操作的 Web Dashboard。
- Dashboard 中每筆事件都有 Timestamp。
- 可在 Discord 指定頻道觸發 Cloudflare R2 上傳詢問。
- 可將附件上傳至 R2 並回傳檔案連結。
- 可選擇保留原始訊息。
- 可在確認成功後刪除原始 Discord 訊息，只留下檔案連結。
- 支援 Windows 本地部署。
- 保留未來遷移 Linux VPS 的能力。
- 具備完整文件、測試及維護能力。

**PulseTools 是一個要長期使用的正式系統，而不是一次性的 Demo。**

請優先確保系統架構、資料安全、穩定性與模組化品質。

現在請開始檢查目前工作目錄，建立開發計畫，接著正式實作 Phase 1。

完成每個階段時提供驗收資訊；確認目前階段可正常運作後，再繼續下一階段。

最終目標是完成可供實際使用、維護及持續擴充的 PulseTools。
