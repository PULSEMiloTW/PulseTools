# 驗收紀錄

2026-10-12（Asia/Taipei）。最終命令結果與公開驗收在交付前更新。

本機 `npm run typecheck`：0 errors／warnings；`npm test`：8 passed；`npm run build`：14 靜態頁成功；`npm run test:e2e`：7 passed。瀏覽器 Microsoft Edge headless。專案未設定 lint。

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

Pages Git integration、production main 與自訂網域／DNS 已設定。公開上線驗收尚待執行，不能以本機測試替代。
