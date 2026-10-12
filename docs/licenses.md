# 素材、資料與依賴

- 品牌：PulseTools 純文字識別，未提供 Logo；根目錄 01–08 Markdown 為使用者的視覺參考。
- 圖示：自行撰寫 SVG 線條；Instagram 頁使用一般相機輪廓，不表示官方認可。
- 字型：系統 fallback，無外部字型下載或再散布。
- Emoji：emojibase-data 17.0.0，Unicode Emoji 17.0 資料，繁中與英文標籤／keywords；MIT，Miles Johnson。來源 https://github.com/milesj/emojibase 、https://emojibase.dev/docs/datasets 。完整序列與 skins，系統原生顯示，無廠商圖片；不宣稱「最新版」。
- 符號、名稱與文案自行整理；未爬取工具邦內容。
- QR：qrcode 1.5.4，MIT，Ryan Day；來源 https://github.com/soldair/node-qrcode 。成熟 UTF-8 PNG／SVG 編碼與容量判斷。
- Astro／React／TypeScript（MIT）：靜態網站及必要互動。版本以 lockfile 為準。
- 測試：tsx、pngjs（MIT），Playwright、jsQR（Apache-2.0）；獨立 QR 解碼依賴僅用於測試。
- 部署：Wrangler（Apache-2.0），僅開發工具。

Emoji／QR 授權聲明保留於 public/third-party-notices.txt，隨網站发布。
