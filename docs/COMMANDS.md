# Phase 1–2 Slash Commands

僅在 DISCORD_COMMAND_GUILD_IDS 指定的 Guild 手動註冊，不自動註冊全域指令。註冊會替換 PulseTools 專用 Application 在指定 Guild 的指令集合，因此不能使用 PulseCore 共用 Application。

註冊前先檢查全部目標 Guild 是否可存取；預檢失敗不寫入任何指令。Discord 10004 表示 Unknown Guild：請開啟 Discord 開發者模式，對伺服器圖示按右鍵複製伺服器 ID（不是頻道、User 或 Application ID），並確認此 PulseTools Bot 已加入。多個目標用逗號分隔；不能由腳本自動選擇其他 Guild 取代。

| 指令 | 用途 |
|---|---|
| /logs status / recent | 本 Guild 紀錄政策與最近十筆事件中繼資料 |
| /logs snapshot | message_id 查閱可用原文與最近十個版本；權限及保存政策限制 |
| /logs event set | type / enabled 開關訊息事件 |
| /logs retention set | days 設定事件及原文期限 1–365 天 |
| /logs capture enable | channel / notice / confirm；公告隱私告知後啟用原文保存 |
| /logs capture disable / exclude | 關閉新原文保存與查閱，或排除 channel |
| /logs capture viewer | user / enabled 明確允許或撤銷原文查看者 |
| /pulse setup | 授權、DB、Intent 與 Bot 基礎權限檢查 |
| /owner status | Owner 安全模式 |
| /owner guild list / allow / deny | Guild Allowlist（allow / deny 使用 guild_id） |
| /owner operator add / remove | 目前 Guild 的成員授權（user、role） |
| /owner lockdown | enabled 設定安全模式 |
| /config view / export | 設定檢視、無 Secret JSON 匯出 |
| /config channel | purpose / channel 設定通知路由用途 |
| /config timezone / language | 時區更新、目前 zh-TW 語言資訊 |
| /config guild status / overview | 目前 Guild 狀態與設定 |
| /module list / info / health | 模組目錄與目前健康狀態 |
| /module enable / disable | 使用 id 切換已實作模組 |
| /system status / ping / uptime / modules | 真實程序、Gateway、Guild、模組資訊 |
| /system diagnostics | Owner 資料庫與記憶體診斷 |

`config` 需先啟用 PT-03。必要 Owner、Module、System 診斷管理不受業務模組停用影響。所有指令先 defer Ephemeral，避免 DB 操作超過 Interaction 首次回覆期限。

`logs` 需 PT-01，並在本機 .env 設定 DISCORD_MESSAGE_EVENTS_ENABLED=true 及 Discord Portal 啟用 Message Content Intent，再由使用者手動重啟。`module health` 顯示生命週期健康狀態，完整健康輪詢於 Phase 4 提供。`pulse setup` 顯示本次程序的 Intents，不代表訊息捕捉已完成驗收。通知頻道路由與 /logs channel / test 於 Phase 3 提供。

其餘 Master Specification 指令於對應階段實作，不註冊不能執行的占位指令。
