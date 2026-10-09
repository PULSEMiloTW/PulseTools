# Phase 1–5 Slash Commands

僅在 DISCORD_COMMAND_GUILD_IDS 指定的 Guild 手動註冊，不自動註冊全域指令。註冊會替換 PulseTools 專用 Application 在指定 Guild 的指令集合，因此不能使用 PulseCore 共用 Application。

註冊前先檢查全部目標 Guild 是否可存取；預檢失敗不寫入任何指令。Discord 10004 表示 Unknown Guild：請開啟 Discord 開發者模式，對伺服器圖示按右鍵複製伺服器 ID（不是頻道、User 或 Application ID），並確認此 PulseTools Bot 已加入。多個目標用逗號分隔；不能由腳本自動選擇其他 Guild 取代。

| 指令 | 用途 |
|---|---|
| /r2 status / test | Guild 策略與唯讀 HeadBucket；test 不上傳物件 |
| /r2 channel add / remove / list | channel；設定監聽 Guild 文字頻道 |
| /r2 config | access、max_mb、max_files、types、prefix、allow_delete、members、prompt_seconds、result_channel；無參數只檢視 |
| /r2 files | Admin 查看本 Guild 最近 25 筆請求 |
| /r2 file info | id 為 Request UUID；上傳者查自己、Admin 查目前 Guild；重新取得一小時私人連結 |
| /logs status / recent | 本 Guild 紀錄政策與最近十筆事件中繼資料 |
| /logs snapshot | message_id 查閱可用原文與最近十個版本；權限及保存政策限制 |
| /logs event set | type / enabled 開關訊息事件 |
| /logs event category | category / enabled 開關一整類已實作事件；舊設定不自動擴大 |
| /logs channel set / list | 分類通知路由；set 使用 category / channel |
| /logs test | 主動發送標示測試的分類通知；不建立假的 Audit |
| /welcome status / preview | 加入／離開通知設定及 Ephemeral 預覽 |
| /welcome channel set | direction:join 或 leave，各自指定 channel |
| /welcome message set | direction / value；支援 Guild、User、ID、人數與帳號建立時間模板 |
| /welcome toggle / account | direction / enabled 開關通知；account 控制建立時間顯示 |
| /welcome test | direction 主動排入標示測試的成員通知 |
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
| /config reset | revision / confirm；重設本 Guild 設定，清空路由並關閉原文保存，保留歷史與模組開關 |
| /config import | file / revision / confirm；64 KiB Discord JSON 附件，不能擴大原文捕捉 |
| /mod warn / timeout / untimeout / kick / ban / unban / purge | PT-04；每次需 reason 與 confirm；解除需 related_case_id |
| /mod history / detail / note | 先選 user；detail／note 的 case_id 選單顯示該人的案件 ID、操作、時間與狀態，note 使用 text；L2 亦需目前原生管理權限 |
| /mod notifications | action / enabled；管理員設定個別案件通知開關 |
| /error list / detail / stats / acknowledge | PT-08；detail／acknowledge 使用 id，global:true 僅 Owner |
| /system history | PT-05 啟用時每分鐘採樣，歷史保存 30 天 |
| /config channel | purpose / channel 設定通知路由用途 |
| /config timezone / language | 時區更新、目前 zh-TW 語言資訊 |
| /config guild status / overview | 目前 Guild 狀態與設定 |
| /module list / info / health | 模組目錄與目前健康狀態 |
| /module enable / disable | 使用 id 切換已實作模組 |
| /system status / ping / uptime / modules | 真實程序、Gateway、Guild、模組資訊 |
| /system diagnostics | Owner 資料庫與記憶體診斷 |

`config` 需先啟用 PT-03。必要 Owner、Module、System 診斷管理不受業務模組停用影響。所有指令先 defer Ephemeral，避免 DB 操作超過 Interaction 首次回覆期限。

`logs` 需 PT-01、DISCORD_MESSAGE_EVENTS_ENABLED=true 與 Message Content Intent；成員事件與 `welcome` 另需 Server Members Intent、DISCORD_MEMBER_EVENTS_ENABLED=true 及 PT-02。Intents 變更需手動重啟，路由／文字／事件開關立即生效。通知輸出頻道排除訊息捕捉，避免回授。`module health` 探測目前 Repository，`system status` 顯示實際健康指標；`pulse setup` 不代表完整事件驗收。`/logs status` 顯示持久化發送結果與失敗代碼。選項值應從 Discord 下拉選單選取。

其餘 Master Specification 指令於對應階段實作，不註冊不能執行的占位指令。
