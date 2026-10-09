# Embed Design System

統一使用 packages/embed-system/src/index.ts。

- 品牌：PulseTools；Footer：Powered by Pulse Studio。
- Discord 原生 timestamp；預設繁體中文。
- 使用者文字 escape markdown 並打斷 mention；發送時 allowedMentions.parse 為空。
- 遵守 Title 256、Description 上限、Field Name 256、Field Value 1024、最多 25 Fields、總字元不超過 6000。
- 成員頭像優先使用 HTTPS Thumbnail，事件色彩由共用 Theme 決定。

| 事件 | 色彩 |
|---|---|
| 成員加入 / R2 成功 | #10B981 |
| 成員離開 | #F87171 |
| 語音 | #8B5CF6 |
| 管理 | #F59E0B |
| 系統 / R2 上傳 | #3B82F6 |
| 錯誤 / R2 失敗 | #EF4444 |

依最新 Master Prompt 明確色彩實作；PulseCore 紫色作為 Dashboard 主題參考，不能覆蓋此事件語意色彩。
