# 本機 PostgreSQL 設定

PulseTools 使用 PostgreSQL，但 PostgreSQL 不必是線上服務。你可以將資料庫直接安裝在這台 Windows 電腦；Bot 透過 `127.0.0.1` 連線，資料留在本機。

## 初次安裝

1. 從 [PostgreSQL 官方 Windows 下載頁](https://www.postgresql.org/download/windows/) 取得官方推薦的 EDB 安裝程式，選擇穩定的 PostgreSQL 17 或 18（不要選 Beta）。
2. 安裝 PostgreSQL Server 與 pgAdmin。Stack Builder 的額外套件不需要安裝。
3. 設定本機管理帳號 postgres 的密碼並自行保存。連線 Port 可使用預設 5432；若本機被占用，選其他 Port 並同步連線設定。
4. 安裝會建立本機 PostgreSQL Windows Service；這是資料庫服務，與 Bot 程序分開。此專案與 Codex 不會替你安裝或修改系統服務。

官方也提供免安裝二進位 ZIP，但需自行管理 initdb、資料目錄、認證及啟停；若希望免 Windows Service，可再改用這種方式。一般本機使用採安裝程式較容易維護。

## 在 pgAdmin 建立專用資料庫

連線本機 Server 後：

1. 在 Login/Group Roles 建立登入角色 `pulsetools_app`，設定獨立密碼並開啟 Can login。
2. 不賦予此角色 Superuser、Create role 或 Create databases 權限。
3. 在 Databases 建立 `pulsetools`，Owner 選 `pulsetools_app`。
4. 另建 `pulsetools_test`，Owner 同上，保留空白供整合測試；不要把正式資料放進去。

## 填入本機 .env

只修改資料庫兩行，保留你已填好的 Discord 與其他機密。下列是占位範例，請在本機換成真正密碼：

```dotenv
DATABASE_URL=postgresql://pulsetools_app:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/pulsetools
TEST_DATABASE_URL=postgresql://pulsetools_app:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/pulsetools_test
```

密碼中的 `@`、`:`、`/`、`#`、`%` 等字元必須使用 URL percent-encoding。連線字串不要貼到聊天或公開截圖。

兩個 URL 只差資料庫名稱，兩個資料庫仍完全獨立。測試資料庫需空白；整合測試不會清除既有資料。

## 初始化一次，日常雙擊啟動

從 PulseTools 根目錄開啟 PowerShell，確認這是新建的專用資料庫後：

```powershell
npm run db:migrate
npm run doctor
npm run test:database
```

首次 Discord 指令註冊另執行 `npm run commands:register`（只針對已指定的 PulseTools 測試 Guild）。這些步驟不藏在日常啟動檔中，也不會重新啟動既有 Bot。

之後雙擊根目錄 `00_啟動PulseTools.cmd`：

- 啟動：檢查本機設定、編譯最新程式並保持控制台。
- 停止：按 Ctrl+C，等待 Bot 程序結束。
- 重啟：停止後再次雙擊啟動檔。
- 不自動重啟；不會操作 PulseCore；重複啟動由資料庫程序鎖阻擋。

PostgreSQL Service 可以保持運作；停止 Bot 不會刪除或清空資料库。資料庫若停止，Bot 會拒絕啟動，請由你在 Windows 服務管理自行恢復。
