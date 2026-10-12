export type SymbolItem = {
  text: string;
  label: string;
  tags: string[];
  group: number;
  skins?: { text: string; label: string }[];
};
const sets = [
  ["箭頭 arrows", "← → ↑ ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇒ ⇑ ⇓ ⇔ ↩ ↪ ➜ ➤"],
  ["數學 math", "+ − × ÷ = ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ ∆ π % ±"],
  ["星形 stars", "★ ☆ ✦ ✧ ✩ ✪ ✫ ✬ ✭ ✮ ✯ ✰"],
  ["框線 box", "─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ═ ║ ╔ ╗ ╚ ╝"],
  ["貨幣 currency", "＄ $ € £ ¥ ₩ ₹ ₽ ₿ ¢ ¤"],
  ["標點 punctuation", "· … — – 「 」 『 』 【 】 《 》 〈 〉 ※ § ¶"],
  ["音樂 music", "♩ ♪ ♫ ♬ ♭ ♮ ♯"],
  ["幾何 geometry", "● ○ ◉ ◎ ■ □ ▪ ▫ ▲ △ ▼ ▽ ◆ ◇ ◐ ◑"],
];
const names: Record<string, string> = {
  "←": "向左 left",
  "→": "向右 right",
  "↑": "向上 up",
  "↓": "向下 down",
  "∞": "無限 infinity",
  "√": "平方根 root",
  "★": "實心星 star",
  "☆": "空心星 star",
  "€": "歐元 euro",
  $: "美元 dollar",
  "£": "英鎊 pound",
  "¥": "日圓 yen",
  "♪": "八分音符 note",
  "●": "實心圓 circle",
  "○": "空心圓 circle",
  "■": "實心方塊 square",
  "△": "空心三角 triangle",
};
export const symbolGroups = sets.map(([label], i) => ({ id: i, name: label }));
export const symbols: SymbolItem[] = sets.flatMap(([label, items], group) =>
  items
    .split(" ")
    .map((text) => ({
      text,
      label: names[text] ?? `${label} ${text}`,
      tags: [label],
      group,
    })),
);
