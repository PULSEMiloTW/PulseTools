# PulseTools 前期規劃與 Codex Prompt

本文件包含可直接交給 Codex 的完整開發 Prompt。以下路由、數量上限與功能細節為專案規劃建議，不代表工具邦全部既有功能。第一版完整涵蓋指定十項工具；開發分階段，但不是只交付首頁或部分工具。

## 入口架構

正式公開主入口為 https://tools.pulse-studio.live，部署平台為 Cloudflare Pages。從專案建立開始就以此正式網域設定網站網址、canonical、sitemap 與公開部署驗收；站內導航仍使用相對路由。十項工具都在同一站內，不需十個子網域。

|分類|工具|正式路由|
|---|---|---|
|時間與展示|線上時鐘|/clock|
|隨機與決策|轉盤|/wheel|
|隨機與決策|隨機分組|/groups|
|隨機與決策|隨機抽籤|/draw|
|隨機與決策|擲硬幣|/coin|
|文字與符號|Emoji|/emoji|
|文字與符號|特殊符號|/symbols|
|文字與符號|酷文字|/cool-text|
|文字與符號|Instagram 字體|/instagram-fonts|
|產生器|QR Code|/qr-code|

首頁 /：品牌導覽 → 短標題與工具搜尋 → 常用工具（有紀錄才顯示）→ 四分類與全部十項工具 → 精簡頁尾。
分類在首頁作為篩選，使用 /?category=random 等網址，第一版不額外建立薄內容分類頁。
桌面工具頁：品牌導覽、精簡工具切換、標題與一句說明、主操作工作區、結果、簡短使用說明、相關工具。
手機工具頁：可收合工具選單，主操作前置，輸入與結果依序排列，避免固定側欄壓縮可用寬度。
其他路由：/about、/privacy、/404。隱私說明需符合實際行為。

首頁不要放大型 Hero、假用戶數、假熱門榜、尚未提供的功能卡片。十項工具應在首頁直接可找，使用搜尋與分類均可定位。

## 設計素材交接

建議使用者提供：
- docs/visual-design.md：主題視覺規格，包含色票、字體、版面密度、圓角、陰影、按鈕、動畫、明暗模式、手機行為、喜歡與禁止的範例。
- public/brand/logo.svg：主要 Logo。
- public/brand/logo-dark.svg：選用；請說明是用於深色背景還是深色圖案。
- public/brand/icon.svg：品牌 icon。
- public/brand/favicon.svg：選用。
- public/brand/apple-touch-icon.png：選用。
- public/brand/tool-icons/：選用的工具圖示。
- docs/brand-assets.md：檔案用途、背景適用情境、安全留白與禁止改動事項。

M 檔先理解為 Markdown（.md）視覺規格檔；若實際為其他格式，由 Codex 讀取可用內容再確認。
收到素材後可調整排版、主題 tokens 與圖示呈現，不改正式工具路由。

## 架構與開發順序

新專案建議 Astro + TypeScript，互動工具使用 React islands，讓首頁與說明內容可靜態產出；共用 React 元件不需要放到所有頁面啟動。若既有專案已有 React/Vite 或其他可用架構，沿用而不強制遷移。
第一版無登入、資料庫、管理後台、跨裝置同步、多人房間、短網址或分析追蹤。所有工具內容在瀏覽器處理。正式部署於 Cloudflare Pages，不依賴 Windows 筆電、本機 API、Tunnel 或常駐 Node.js 伺服器。深層路由要能直接開啟與重新整理。
本地紀錄：收藏、最近工具、主題、時鐘設定可存在 localStorage；抽籤名單只在使用者主動勾選保存時寫入；QR 輸入與 Wi-Fi 密碼不持久化。提供清除本站資料。
不要承諾完整離線能力；第一版沒有 Service Worker/PWA。
開發順序：
1. 讀取素材與 repository 規範，建立路由、設計 tokens、首頁與工具外框。
2. 完成共用剪貼簿、輸入解析、Unicode 映射、隨機整數與洗牌，再完成 Emoji、符號、文字兩頁與 QR。
3. 完成時鐘、分組、抽籤、硬幣。
4. 完成轉盤與動畫，執行跨工具與手機驗收。
每階段完成可运行版本並紀錄進度，持續做到十項全部完成。

## 可直接交給 Codex 的完整 Prompt

以下開始為完整 Prompt，可連同視覺與品牌檔案一起交給 Codex：

你是 PulseTools 的專案工程師。請在目前 repository 製作完整可运行、可部署的繁體中文工具網站，正式公開網址為 https://tools.pulse-studio.live，部署目標為 Cloudflare Pages。從開始就按正式網域規劃、設定與驗收，不把 localhost 或 pages.dev 當成最終交付網址。功能參考 https://tw.piliapp.com/ ，使用我提供的品牌與視覺規格自行實作。參考功能與操作流程，不複製第三方原始碼、Logo、圖片、文案或整體版面。

我已授權本專案在完成必要驗收後，建立或更新 PulseTools 的 Cloudflare Pages 專案、綁定 tools.pulse-studio.live 並公開部署，不需要再次詢問是否上線。可使用本機開發與預覽驗證，但最終需交付正式網域。缺少 Cloudflare／GitHub 存取權限時，先完成程式、建置、測試與部署檔案，再明確列出需要我完成的登入或授權；不要虛構已部署，也不要把憑證寫入 repository。

不要只交付規劃、首頁、UI mockup、失效按鈕或 placeholder。請分階段持續實作直到以下十項工具及共用功能完整可用，再交付。若遇到缺少外部憑證或素材等真正阻礙，指出受阻部分並繼續其他可完成工作，不冒充完成。

一、開始前與素材優先順序
1. 先讀取 AGENTS.md、現有 package.json、路由與元件，再讀 docs/visual-design.md、docs/brand-assets.md 及 public/brand/。
2. 本 Prompt 的功能與可用性要求優先；視覺規格決定造型、色彩與排版；沿用 repository 現有可用技術。視覺規格與必要可用性衝突時解釋衝突並保留必要操作。
3. 不擅自重畫、變色、拉伸或裁切品牌 Logo。品牌 icon 不當作每項工具的相同 icon。
4. 若素材缺少，用 PulseTools 純文字識別與簡潔中性樣式繼續，交付時列出缺少檔案，不捏造已套用我的設計。
5. 僅修改本專案必要範圍，保留既有無關功能。程式碼內不加入解釋性註解；必要說明寫在文件與最終對話。

二、技術與部署
1. 新專案採 Astro + TypeScript，互動工作區用 React islands；若現有可用架構已建立則沿用。選當時穩定相容版本並保留 lockfile。
2. 第一版全部核心運算與輸入在瀏覽器內完成，無需伺服器 API、登入、資料庫或付費服務。
3. 優先使用瀏覽器原生 API 與 CSS。QR 使用成熟的開源 QR 編碼套件（例如 qrcode，https://github.com/soldair/node-qrcode），不得手寫 QR 編碼器。不要因為追求零依賴犧牲正確性。
4. 共用設計 tokens、工具資料登錄、名單解析、隨機與文字轉換函式；不建立外掛平台、通用工作流引擎、全域狀態框架或微服務。
5. 公開頁面靜態輸出，直接開啟每個深層路由可用。附 build、preview 與 Cloudflare Pages 部署說明；站內導航使用相對路徑，正式網站基底網址統一為 https://tools.pulse-studio.live。
6. 不加廣告、第三方分析追蹤、短網址、多人同步、PWA 或未要求的新工具。
7. 使用 Astro 時明確採 static output，設定 site 為 https://tools.pulse-studio.live；純靜態部署不加入 SSR、Cloudflare adapter、Pages Functions 或 Workers 後端。React islands 仍於訪客瀏覽器執行。
8. 優先使用 GitHub 與 Cloudflare Pages 的 Git integration。檢查既有 repository 與專案後沿用適合的設定，避免建立重複專案。使用 npm 時 build command 為 npm run build、build output directory 為 dist；若沿用其他套件管理器或架構，依實際專案設定相應命令並記錄。鎖定相容 Node.js 版本與 lockfile，production branch 採實際主分支。
9. 在 Pages 專案先新增 tools.pulse-studio.live 自訂網域，再依 Pages 提供的目標設定該子網域 DNS；僅處理 tools 這個主機名稱。若已有衝突記錄，先辨識原有服務，不能盲目刪除或取代。不得改動其他 Pulse 子網域、根網域服務、MX 或整個網域的 nameserver；需要超出此範圍時列明原因與待處理項目。
10. 檢查正式網域 DNS、HTTPS 憑證與 HTTP→HTTPS 行為，公開訪客无需 Cloudflare Access 登入。不關閉其他專案的存取保護。
11. 正式域名作唯一 SEO 主網址，canonical 與 sitemap 使用 https://tools.pulse-studio.live；robots.txt 引用正式 sitemap。預覽部署不應被搜尋引擎索引；公開的 pages.dev 入口視可用權限設置保留路徑與 query 的正式網域重新導向，不能讓所有工具都導到首頁。部署安全標頭時驗證不阻擋工具、剪貼簿與全螢幕功能。

三、入口與共用 UI
1. 正式路由：/、/clock、/wheel、/groups、/emoji、/symbols、/draw、/coin、/cool-text、/instagram-fonts、/qr-code、/about、/privacy。
2. 分類：時間與展示；隨機與決策；文字與符號；產生器。首頁提供工具名／別名／關鍵字搜尋、分類篩選、工具直達。
3. 十項工具都是獨立可收藏的網址。收藏與最近使用存在本機，只依據使用者實際紀錄呈現，不偽造使用排行。無紀錄不顯示空白的大區塊。
4. 首頁採緊湊工具入口，不放大型行銷 Hero。各工具採適合任務的版面：時鐘大顯示、轉盤舞台與名單、分組結果欄、符號網格、文字預覽列表、QR 輸入與預覽。不把全部頁面做成相同卡片模板。
5. 工具頁具返回首頁、精簡工具切換、標題、一句用途、主工作區、短說明及相關工具。手機選單可收合，不用常駐大型側欄。
6. 全站繁體中文、html lang=zh-Hant；頁面各自有 title、description、H1。產出 sitemap，每頁 canonical 與 sitemap 絕對網址使用 https://tools.pulse-studio.live，含正式工具路徑。
7. 依視覺規格套用主題；若未指定，提供明暗模式，初始跟隨系統，保存主動選擇。
8. 觸控可用、鍵盤可操作、可見焦點、表單 label、必要 ARIA、正常文字至少 4.5:1 對比。尊重 prefers-reduced-motion，操作回饋不能只靠顏色。
9. 320px 手機到桌面無頁面水平溢出；結果長字可換行，時鐘數字不換行。複製成功與失敗有真實回饋，剪貼簿失敗提供可選文字手動複製。
10. localStorage 讀写失敗、容量滿、舊資料損毀不導致整站無法使用。可清除本站資料，不清除其他站點資料。

四、各工具完整功能

A. 線上時鐘 /clock
- 正常模式只有時區、樣式選擇與進入全螢幕按鈕作為工具控制；不擅加鬧鐘、倒數、時間比較或額外顯示設定。
- 預設 Asia/Taipei，使用 IANA 時區與 Intl.DateTimeFormat，時區可搜尋城市中英文名稱；至少提供台北、東京、首爾、香港、上海、新加坡、倫敦、巴黎、紐約、洛杉磯、雪梨、UTC。對無效時區安全回退。
- 提供四種真正有區別的樣式：極簡數字、LED、翻頁、指針。固定顯示秒；指針顯示選定時區時間，非裝置本地時區。保存時區與樣式。
- 時間來源為裝置系統時間，不宣稱原子鐘或 NTP 校準。每次更新讀取當下時間，不累加計時器以免漂移；切回分頁後立即更新。用正確時區規則處理跨日与夏令時間。
- 按鈕觸發原生 Fullscreen API；只對時鐘舞台請求全螢幕，不讓網站導覽進入。純展示模式僅有時鐘與必要時區文字，所有網站導航、頁尾、設定与操作按鈕隱藏。
- 桌面 Esc 退出，監聽 fullscreenchange 同步狀態，恢復正常模式並把焦點還給進入按鈕。不能只用自己的布林值判定原生全螢幕狀態。
- 偵測不支援或請求失敗時，在按鈕互動後改為填滿網頁視窗的展示模式，明確告知此模式無法移除瀏覽器介面；Esc 可退出。
- 觸控裝置沒有 Esc，提供不常駐的退出手勢：點一下展示區退出或顯示短暫退出提示，不放常駐工具控制。進入前讓使用者知道如何退出。外接鍵盤仍支援 Esc。
- 清理計時器与事件，不在螢幕閱讀器每秒播報。翻頁動畫支援減少動態效果。

B. 轉盤 /wheel
- 每行一個選項，trim 首尾與忽略空行；最多 100 項、每項最多 80 個 Unicode code points。超過限制明確提示，不靜默截斷。
- 選項可編輯、清空、載入不含真實個資的範例；至少兩個選項才可旋轉。
- 預設每列一票，同名選項仍是不同票，提示同名增加權重；提供主動去重按鈕，禁止預設偷偷去重。
- 每次按下旋轉先用共用安全亂數抽出 winning ID，再計算最終角度并執行動畫。指針、扇區与顯示結果必須一致，不能動畫完成再另外抽一次。
- 動畫中禁止再次抽取、修改名單或重設；頁面背景／動畫取消的情況仍保留單一已決定結果，不重抽。
- 揭示结果，預設抽後保留；可切換抽後移除中獎票，依唯一 ID 移除該票，不誤刪全部同名項目。
- 提供重新開始、當次結果紀錄和複製。長名稱顯示省略，但結果显示全文；大量項目避免字重疊。

C. 隨機分組 /groups
- 每行一人，最多 1,000 人、每人最多 80 code points。trim 與忽略空行，保留同名但提示可用編號區分。
- 支援指定組數或每組最多人數，兩模式互斥；組數必須是 1 到總人數的整數，每組最多人數亦為有效正整數。
- 先 Fisher–Yates 洗牌再平均分配；每組人數差最多 1，每人恰好出現一次。
- 每組最多人數模式先用 ceil(總人數/上限) 求組數，再均衡分配，不超過上限。
- 顯示各組人數、可編輯組名、重新分組、複製全部與下載 UTF-8 純文字結果。
- 不加入指定隊長、強制分開名單或自動能力平衡。

D. Emoji /emoji
- 分類、中文与英文關鍵字搜尋、點選複製、最近使用与收藏。
- 使用 Unicode Emoji 與 CLDR 的正式資料或具有適用授權的資料來源，記錄實際版本、來源、授權，不硬編碼未查核的「最新版」。
- 完整處理 ZWJ、變體選擇符、旗幟、膚色序列，不把一個 Emoji 拆成多個字元複製。支持有膚色變體的 Emoji 選擇膚色。
- 初版用系統原生 Emoji 顯示，不抓取 Apple 等廠商圖案。說明外觀与支援程度依裝置不同。
- 大型資料分批呈現或漸進載入，搜尋要能找到尚未渲染的完整資料。

E. 特殊符號 /symbols
- 提供箭頭、數學、星形、框線、貨幣、標點、音樂、幾何等分類，中英文搜尋、點選複製、最近使用与收藏。
- 名稱与關鍵字資料自行整理或採用授權適用資料；不直接整包爬取工具邦內容。
- 複製真实 Unicode 文字，保留必要變體，不以圖片或 HTML 代替。

F. 隨機抽籤 /draw
- 以「輸入名單→洗牌→背面籤卡→點選揭曉」為主要流程，與轉盤有不同互動。
- 名單上限 200 項，每項 80 code points，規則同上；至少兩項才可開始。
- Fisher–Yates 於開始時決定每張卡內容，點選只揭示已決定項目。背面不可洩露文字，不能每次點卡重抽。
- 已揭示的卡不可再次抽取；提供抽一張、一次抽 N 張、剩餘張數、當次紀錄、複製与重新洗牌。N 限 1 到剩餘張數。
- 同名票有獨立 ID，揭示後不重複抽到同一張卡。重設會清空當輪結果；修改名單先提示會開始新一輪。
- 第一版是本機一般用途工具，不宣稱有公證或可供第三方驗證，沒有分享或多人房間。

G. 擲硬幣 /coin
- 預設正面／反面，單枚硬幣；可自訂兩側短文字。
- crypto.getRandomValues 取得公平二選一結果，先決定結果再播放 CSS 翻轉動畫，結果文字与硬幣落面一致。
- 動畫中防重複觸發；顯示本輪次数与兩面统计，提供清除紀錄。減少動態效果时直接揭示。
- 不需要 3D 引擎，不暗示下一次會因歷史結果補償機率。

H. 酷文字 /cool-text
- 輸入後即時產生至少 12 個具有不同視覺的 Unicode 樣式：粗體、斜體、粗斜體、無襯線、無襯線粗體、等寬、雙線、花體、Fraktur、小型大寫、圈字、全形。
- 各列顯示样式名稱、真實轉換結果與複製按鈕。輸入最多 2,000 code points，超限提示。
- 正確使用 Unicode code points 與明確映射表，處理花體、Fraktur、雙線等非連續編碼例外。不能單純對所有風格用固定偏移導致錯字。
- 字型映射主要針對受支援的拉丁字母／數字；保留中文、Emoji、換行与不支援字元，不捏造中文花體能力。映射不支持的數字保留原值。
- 結果是可複製純文字，不是 CSS 字體截图；說明顯示與可用性受目標平台影響。

I. Instagram 字體 /instagram-fonts
- 共用酷文字的同一套轉換核心，但保留獨立頁面与社群用途入口。
- 主打自介、暱稱与貼文，優先展示花體、粗體、雙線、小型大寫與裝飾文字，至少 12 種選項；提供可自行編輯的示範文字。
- 可組合 Emoji／符號，提供返回相關工具的链接；裝飾字符自有或授權可用，不複製工具邦文案。
- 不串 Instagram API、不要求登入，不承諾每種文字能用於帳號 username，不假裝與 Instagram 官方有合作。
- 同樣保留中文与完整 Emoji；說明特殊 Unicode 可能影響搜尋、螢幕閱讀器及字數計算。

J. QR Code /qr-code
- 核心必須是靜態 QR：直接編碼使用者內容，绝不偷偷換成 PulseTools 或第三方的 redirect、短網址、追蹤碼。已下載圖片可在網站停運後被讀取。
- UI 說明「QR Code 本身無到期日；若內容是網址，能否開啟仍取決於目標網站」。不得宣稱所有連結永久可用。
- 第一版支援網址、純文字与 Wi-Fi。網址限 HTTP/HTTPS 並提示格式；沒有協定時提示或明確讓使用者選擇補上 HTTPS，不靜默修改。純文字保留用户原文。
- Wi-Fi 支援 SSID、密碼、隱藏網路及 WPA/WPA2、WEP、無密碼的標準 payload；依格式正确跳脫反斜線、分號、逗號、冒號及雙引號。密碼預設遮蔽。
- 即時預覽、可選輸出尺寸、容錯等級 L/M/Q/H，預設 M；下載 PNG 與 SVG，無浮水印，支援繁體中文。
- 黑白高對比、至少四模組 quiet zone、整数像素／清晰模組、不可裁切；第一版不加入自訂 Logo、渐層或會破壞掃描的自由造型。
- 根據實際 UTF-8 byte 長度、編碼与容錯能力驗證容量；超限需清楚報錯，不產出錯誤圖片。不用單一中文字數上限假裝代表容量。
- 输入更改時防止非同步競態，下載內容必須與當下預覽一致；空輸入與生成失敗不能下載舊碼。
- 全程本機生成，不上傳、不保存 QR 内容或 Wi-Fi 密碼到 localStorage、log 或 URL；無到期服務與訂閱。

五、共用正確性與狀態
1. 共用 randomInt(maxExclusive) 使用 crypto.getRandomValues 与 rejection sampling 消除 modulo bias，驗證邊界，不用 Math.random 作正式結果，不用 sort(() => Math.random() - 0.5) 洗牌。
2. Fisher–Yates 使用上述整數函式。亂數與動畫解耦，結果只決定一次。
3. 所有名單每列有獨立 ID；重复名稱不等於相同資料項目。提供明确重複提示，不自动改变機率。
4. 使用者輸入一律以文字安全渲染，不用 dangerouslySetInnerHTML；下載 SVG 只來自可信編碼器，文字结果不是 HTML。
5. 全部預設示範必須可替換；保存名單為可選且預設關閉，勾選時說明本機保存。設定、收藏、最近使用可自動保存，QR 輸入不保存。
6. 名單上限、長度限制、錯誤與空狀態寫清楚；重设当輪結果或清除已保存名單等會丟失資料的操作要有合適確認。
7. 重新整理不自动重抽、不重播結果动画。不把本機随机結果包装成可驗證的官方抽獎服務。

六、驗收與交付
- 使用現有測試工具；若專案缺少工具，加入最小但可重复执行的逻辑测试与關鍵 E2E，避免只有人工宣稱通过。
- 邏輯測試覆蓋：randomInt 邊界與 rejection 分支、洗牌保留完整 ID、多組人數差≤1、不漏人、同名處理、不放回抽籤、Unicode 非連續映射、ZWJ 与中文保留、Wi-Fi 特殊字元。以可控制亂數驗證，不用機率分布閾值當作容易偶發失敗的 CI 測試。
- 轉盤至少測試 2、3、100 項與角度跨 0°，指針命中与结果一致；动画中重按不產生第二結果。
- QR 以獨立解碼器測試 PNG 内容與輸入一致，覆盖繁中網址／純文字／Wi-Fi；SVG 檢查或轉圖後解碼。另記錄 iOS、Android 真機掃描需人工驗收，無真機時列待測，不捏造完成。
- 時鐘用固定时间測跨日与夏令時、四樣式同一時區一致；全螢幕进出、Esc、請求拒絕与触控 fallback 都要有测试或明确人工驗收记录。
- 全站十路由直達、重新整理、搜尋、收藏、复制、清除資料、320px 与桌面版面、鍵盤、減少動態效果要验证。
- 執行 typecheck、專案 lint（如有）、必要 tests、production build。新增依赖记錄理由與授權。
- 真正用瀏覽器檢查首頁與十工具的主要操作；可用環境无瀏覽器或真機時，列明未测项目與具體步骤，不声称已驗收。
- 交付可运行原始碼、lockfile、README（安裝／啟動／測試／build／部署）、工具规格與驗收紀錄、素材來源与授權清單。保留完整進度檔，若跨上下文從进度繼續，不重建已完成部分。
- 建置與必要測試通過後，依本 Prompt 的既有授權公開部署至 Cloudflare Pages，綁定 https://tools.pulse-studio.live。避免把尚未完成的工具占位頁當作正式完成版本；後續更新亦須通過相應檢查。
- 公開部署後對正式域名執行 smoke test：首頁與十項工具皆能直接開啟和重新整理、靜態資源無 404、HTTPS 正常、canonical 與 sitemap 正確、隨機工具與 QR 主要流程可用。不存在路由回傳真正 404，不把 Astro 多頁靜態網站一律改成 SPA fallback。
- 交付 README 中的 Pages 專案、production branch、build command、output directory、Node.js 版本、自訂網域、DNS 設定與回滾步驟，不寫入 token。登入或 DNS 權限不足時，將部署標記為受阻，列出已完成工作與最小待辦，不假稱正式網域已上線。
- 最終回覆簡述完成內容、實際測試結果与未測限制，提供正式網址與部署狀態；不使用假數據、不省略剩下工具。

## 查核來源

查核日期：2026-10-12。網頁可變動，後續實作仍需核對依賴版本与相容性。
- 工具邦總覽：https://tw.piliapp.com/
- 時鐘：https://tw.piliapp.com/time/
- 轉盤：https://tw.piliapp.com/random/wheel/
- 分組：https://tw.piliapp.com/random/team/
- 抽籤：https://tw.piliapp.com/random/lots/
- 硬幣：https://tw.piliapp.com/random/coin/
- Emoji：https://tw.piliapp.com/emoji/list/
- 特殊符號：https://tw.piliapp.com/symbol/
- 酷文字：https://tw.piliapp.com/cool-text/
- Instagram 字體：https://tw.piliapp.com/instagram/fonts/
- QR：https://tw.piliapp.com/generator/qr-code/
- Fullscreen API 官方開發文件：https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
- Unicode Emoji 規格：https://www.unicode.org/reports/tr51/
- QR 編碼套件原始碼與說明：https://github.com/soldair/node-qrcode
- Cloudflare Pages Astro 部署：https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- Cloudflare Pages 自訂網域：https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Pages 平台限制：https://developers.cloudflare.com/pages/platform/limits/

注意：工具邦 QR 頁將容錯比率與可覆蓋圖示面積作簡化對應；本專案不採用該比例作掃描保證，第一版不疊 Logo。容錯等級對受損碼字的恢復能力不等於任意遮蓋同百分比圖形一定可掃。
