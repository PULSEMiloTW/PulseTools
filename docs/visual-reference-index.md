# Pulse 視覺設計規範

版本：1.0 · 整理日期：2026-10-12 · 適用：新專案的網站、管理介面與操作工具。

這是一套可整個資料夾複製使用的 Markdown 設計規範。以 PulseVeto 現有非 Overlay 介面為起點，將品牌特徵與新專案的建議尺寸分開記錄；不代表 PulseVeto 所有頁面已實作同一套設計系統，也不要求搬移原專案的技術架構。

## 文件索引

| 文件 | 內容 |
| --- | --- |
| [01-BRAND.md](01-BRAND.md) | 品牌方向、識別、視覺語言與素材 |
| [02-COLOR-TOKENS.md](02-COLOR-TOKENS.md) | 色彩、雙主題與可複製 CSS Token 範本 |
| [03-TYPOGRAPHY.md](03-TYPOGRAPHY.md) | 字型、字級、行高、中英混排與文字層級 |
| [04-LAYOUT.md](04-LAYOUT.md) | 間距、容器、網格、響應式與資訊結構 |
| [05-COMPONENTS.md](05-COMPONENTS.md) | 按鈕、表單、卡片、表格、導覽與對話框 |
| [06-INTERACTION-CONTENT.md](06-INTERACTION-CONTENT.md) | 動效、操作回饋、多語系與介面文案 |
| [07-QUALITY-CHECKLIST.md](07-QUALITY-CHECKLIST.md) | 設計與瀏覽器驗收清單 |
| [08-PROJECT-STARTER.md](08-PROJECT-STARTER.md) | 新專案設定表、設計提示詞與代理規範片段 |

## 直接沿用的方式

1. 複製整個 `design-system/` 至新專案的 `docs/`，保留相對連結。
2. 填寫 `08-PROJECT-STARTER.md` 的產品設定表，確認品牌、頁面類型、語系與主題。
3. 採用色彩 Token 與排版／間距預設，再按實際內容調整；將必要例外記錄在設定表。
4. 實作代表性的列表、表單及詳細頁，使用品質清單驗收。
5. 規則變更時同步更新文件與對應樣式，避免文件與產品各自演進。

新專案的明確需求優先於此套範本。同一產品共用基礎 Token；特殊頁面透過語意或元件 Token 覆寫，不另建整套顏色與字級。

## 來源與適用界線

本次查閱 PulseVeto 工作目錄的 `public/home.css`、`public/index.html`、`public/admin-hierarchy.css`、`public/manage.html`、`public/operation-theme.css`、`public/result.css`、`public/result.html`、`public/assets/fonts/README.md` 與專案代理規範。部分工作目錄內容尚未提交；此處是來源整理，不是部署狀態或瀏覽器驗證報告。

- **來源特徵**：藍紫品牌色、明暗介面、語意狀態色、系統無襯線字型、響應式與減少動態效果支援。
- **建議預設**：統一字級、4px 間距尺度、元件尺寸、容器及驗收流程。這些數值為本套文件新訂的基準，不宣稱每個既有頁面皆符合。
- **產品專屬**：BP、隊伍、比分、賽事管理與 Overlay 要求另標註為 PulseVeto 延伸；一般專案可略過。

此資料夾可獨立使用，不含原專案素材、字型二進位檔、秘密、服務操作或部署授權。
