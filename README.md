# PulseTools

繁體中文日常工具網站，正式網址：https://tools.pulse-studio.live。Astro 靜態輸出＋React islands，十項工具在訪客瀏覽器處理，無後端、資料庫或登入。

## 開發與檢查

使用 Node.js 24.13.0、npm 與 package-lock.json。

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run preview
```

瀏覽器測試使用已安裝的 Microsoft Edge；其他環境可調整 playwright.config.ts 的 channel。測試會啟動 4321 預覽，執行時該埠須空閒。build/dev 從鎖定的 Emojibase 套件產生 public/emoji-data.json，生成輸出不提交。

## 功能與資料

十項工具：時鐘、轉盤、分組、抽籤、硬幣、Emoji、特殊符號、酷文字、Instagram 字體、QR Code。規格以 [主要需求](PulseTools-Plan-and-Codex-Prompt.md) 為準。

設定、收藏與最近紀錄存於 `pulsetools:` 前綴的 localStorage；名單須主動勾選才保存，QR 原文與 Wi-Fi 密碼不保存或上傳。沒有 PWA、廣告、分析追蹤或跨裝置同步。

根目錄保留需求與視覺原檔；原視覺 README 索引備份於 [docs/visual-reference-index.md](docs/visual-reference-index.md)。正式 Logo 尚未提供，使用文字識別。另見 [授權](docs/licenses.md)、[驗收](docs/acceptance.md)、[進度](docs/progress.md)。

## Cloudflare Pages

- 專案：`pulsetools`，Git integration：`PULSEMiloTW/PulseTools`
- Production branch：`main`
- Build command：`npm run build`
- Output：`dist`，root：repository 根目錄
- Production/preview：`NODE_VERSION=24.13.0`
- 自訂網域：`tools.pulse-studio.live`
- DNS：僅 `tools` CNAME → `pulsetools.pages.dev`，Proxy 開啟，TTL 自動

先在 Pages 加入自訂網域，核對無衝突後新增 DNS。CLI OAuth 無 DNS scope，故 DNS 透過已登入控制台設定。其他主機、MX 與 nameserver 未調整。憑證不存進 repository。

main push 觸發自動建置；備援手動部署：`npx wrangler pages deploy dist --project-name pulsetools --branch main`。無 Functions／Workers 後端或 SPA fallback。回滾於 Pages Deployments 選擇先前成功的 production deployment，執行 Rollback；不改寫 Git 歷史。首次部署沒有舊版本可回滾。

正式部署與公開 smoke test 見驗收紀錄，push 本身不表示已上線。
