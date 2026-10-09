# Supabase 設定

PulseTools 使用 Supabase 的 PostgreSQL Session pooler（5432），不使用 Transaction pooler（6543）。保持 Data API 停用，資料由後端存取。

在本機 .env 填入 Dashboard Connect 提供的 DATABASE_URL，保留其他機密。不要把密碼或完整字串貼到聊天。

## CA 憑證

若出現 SELF_SIGNED_CERT_IN_CHAIN，從 Supabase Dashboard 的 Database Settings → SSL Configuration 下載 CA 憑證。將檔案存成專案根目錄 `supabase-ca.crt`，在 .env 加入：

```dotenv
DATABASE_SSL_CA_PATH=./supabase-ca.crt
```

不使用 rejectUnauthorized=false，不透過未驗證的連線取得可被信任的 CA。遠端 PostgreSQL 必須驗證憑證與主機名稱。

確認 CA 與專用專案後執行 migration，再用 doctor 檢查。Bot 的啟動與重啟由使用者手動操作。

TEST_DATABASE_URL 可留空；Supabase 執行 `npm run test:database:sandbox` 使用獨立 Schema，測試後自動清除本次新建 Schema。一般 `test:database` 仍只接受另一個專用空測試資料庫，不能直接將使用中的 Supabase URL 填入 TEST_DATABASE_URL。
