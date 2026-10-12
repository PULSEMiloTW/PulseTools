# 驗收紀錄

2026-10-12（Asia/Taipei）。最終命令結果與公開驗收在交付前更新。

本機 `npm run typecheck`：0 errors／warnings；`npm test`：8 passed；`npm run build`：14 靜態頁成功；`npm run test:e2e`：8 passed（含慢速腳本載入與鍵盤焦點）。瀏覽器 Microsoft Edge headless。專案未設定 lint。

## 覆蓋內容

- randomInt 邊界／rejection、洗牌完整 ID、同名、均衡分組／上限、不放回抽籤。
- Unicode 雙線／花體／Fraktur 例外、中文／ZWJ／旗幟保留、膚色資料。
- 轉盤 2／3／100 票、跨 0° 與指針命中；瀏覽器動畫防重按。
- QR 獨立 jsQR 解碼 PNG，繁中 URL／原文／Wi-Fi 特殊字元；SVG quiet zone；更改／清空輸入不下載舊碼。
- 時鐘固定時間跨日／紐約夏令時間／無效時區；四樣式、原生全螢幕、拒絕 fallback、Esc／點擊退出與焦點。
- 首頁＋十工具＋說明頁直達／重整、canonical、320px／桌面、主題、搜尋、收藏、最近紀錄、僅清除本站、storage 損毀／拒絕、console、404。
- 主要操作：分組、籤卡揭曉、硬幣減少動態、文字、完整 Emoji 搜尋／複製／膚色、剪貼簿拒絕 fallback。

## 待人工驗證

- iOS／Android 真機掃 QR：相機掃描網址、繁中純文字及 Wi-Fi，確認 PNG／SVG 内容與連線。
- 真機觸控、裝置字型；目前以瀏覽器手機寬度及點擊退出驗證。
- 正式 Logo 未提供，採文字識別。

## 正式部署

初始功能 commit 0b711cf 已由 Git integration 成功部署（deployment 0a0c21c7）。正式首頁與十項工具 200、深層重整、無資源 404、canonical／sitemap、隨機／QR 主要流程、真正 404 已通過公開 smoke test。

HTTP `/clock?source=smoke` → HTTPS 同路徑與 query（301）。控制台設定 Bulk Redirect 清單 pulsetools_canonical／規則 PulseTools canonical domain，僅匹配 pulsetools.pages.dev，301 保留 query／子路徑／路徑尾碼，不包含預覽子網域；实測 `/clock?source=smoke` 正確指向正式網域。預覽 pages.dev 回應含 X-Robots-Tag: noindex。

完整遠端 E2E 曾發現 hydration 前控制項可操作而忽略輸入，已新增原生 disabled fieldset 及啟動提示，並加入延遲載入測試。

修正 commit a5c8850，Pages deployment 9548072a 成功。設定 PULSETOOLS_TEST_URL=https://tools.pulse-studio.live 的完整 E2E：8 passed（38.2s）。再執行 `node scripts/public-smoke.mjs`：PUBLIC SMOKE PASSED。HTTP 與 pages.dev 均 301 至 HTTPS 正式網域，路徑／query 正確保留。公開無 Access 登入要求，安全標頭未阻擋剪貼簿與全螢幕。PNG QR、轉盤與首頁桌面／320px 截圖保留於本機 artifacts/，不提交生成圖片。
