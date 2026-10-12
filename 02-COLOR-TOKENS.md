# 色彩與設計 Token

## 品牌原色：來源特徵

| 名稱 | 色碼 | 用途 |
| --- | --- | --- |
| Pulse Blue | `#5865F2` | 品牌、主要動作、選取識別 |
| Veto Violet | `#8B5CF6` | 品牌輔助、漸層終點 |
| Signal Blue | `#7289FE` | 深色介面的識別點綴 |
| Lavender | `#A78BFA` | 深色背景的紫色點綴 |
| Cyan | `#38BDF8` | 少量訊號與重點 |
| Void / Carbon | `#090B10` / `#11141B` | 深色底層／面板 |
| Pure / Cloud / Mist | `#FFFFFF` / `#F7F8FC` / `#EEF1F7` | 淺色面板／背景／次要表面 |

首頁的藍紫色是可攜品牌基準；既有管理頁另有 `#6D42D8` 等頁面用色。新專案可將這類差異映射為語意 Token，不宣稱原專案已統一。

## 語意色

| 語意 | 原色 | 使用規則 |
| --- | --- | --- |
| 成功 | `#22C55E` | 完成、成功狀態；PulseVeto 對應 PICK |
| 危險 | `#EF4444` | 失敗、破壞性操作；PulseVeto 對應 BAN |
| 警示 | `#F59E0B` | 注意狀態；PulseVeto 對應 DECIDER |
| Team A | `#5865F2` | PulseVeto 隊伍 A 的穩定識別 |
| Team B | `#A855F7` | PulseVeto 隊伍 B 的穩定識別 |

狀態與隊伍用不同 Token，即使色碼相近也不共用變數。狀態同時提供文字或圖示，不以顏色作為唯一線索。亮綠／亮黃等原色適合標記；文字與按鈕需使用經背景配對檢查的前景色，不直接把原色當小字。

## Token 架構：建議預設

原始值 → 語意別名 → 必要的元件別名。小型專案以前兩層為主；只有元件需要獨立調整時才增加第三層。以下可放入新專案的全域 CSS，不需新增套件。

```css
:root {
  color-scheme: light;
  --pulse-blue: #5865f2;
  --veto-violet: #8b5cf6;
  --color-bg: #f7f8fc;
  --color-surface: #ffffff;
  --color-surface-muted: #eef1f7;
  --color-text: #151823;
  --color-text-muted: #596174;
  --color-border: #dde2ec;
  --color-control-border: #737d91;
  --color-primary: var(--pulse-blue);
  --color-on-primary: #ffffff;
  --color-primary-hover: #4652d9;
  --color-focus: #4652d9;
  --color-success-text: #166534;
  --color-success-bg: #f0fdf4;
  --color-danger-text: #b91c1c;
  --color-danger-bg: #fef2f2;
  --color-warning-text: #854d0e;
  --color-warning-bg: #fffbeb;
  --gradient-brand: linear-gradient(135deg, var(--pulse-blue), var(--veto-violet));
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --radius-control: 0.625rem;
  --radius-panel: 1rem;
  --shadow-panel: 0 12px 32px rgb(21 24 35 / 8%);
  --button-bg: var(--color-primary);
  --button-text: var(--color-on-primary);
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-bg: #090b10;
  --color-surface: #11141b;
  --color-surface-muted: #191d27;
  --color-text: #edf2ff;
  --color-text-muted: #aeb6cb;
  --color-border: #3c4352;
  --color-control-border: #8190ac;
  --color-focus: #a78bfa;
  --color-success-text: #86efac;
  --color-success-bg: #142a20;
  --color-danger-text: #fca5a5;
  --color-danger-bg: #32191e;
  --color-warning-text: #fcd34d;
  --color-warning-bg: #302715;
  --shadow-panel: 0 12px 32px rgb(0 0 0 / 25%);
}

.primary-button {
  color: var(--button-text);
  background: var(--button-bg);
}

:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
}
```

細分隔線與必要控制項邊框分開使用。範本是起始值，不是已完成的無障礙認證；漸層、透明度、圖片底色、懸停及焦點狀態都需要按實際組合驗收。主題只改語意映射，元件不分散硬編碼兩套色值。
