import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const en = new Map(
  require("emojibase-data/en/data.json").map((e) => [e.hexcode, e]),
);
const items = require("emojibase-data/zh-hant/data.json")
  .filter((e) => e.group !== undefined)
  .map((e) => ({
    text: e.emoji,
    label: e.label,
    tags: [
      ...(e.tags ?? []),
      en.get(e.hexcode)?.label ?? "",
      ...(en.get(e.hexcode)?.tags ?? []),
    ],
    group: e.group,
    skins: e.skins?.map((s) => ({ text: s.emoji, label: s.label })),
  }));
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/emoji-data.json", JSON.stringify(items));
