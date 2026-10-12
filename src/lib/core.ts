export type Ticket = { id: string; name: string };
export function randomInt(
  max: number,
  source: (a: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer> = (a) =>
    crypto.getRandomValues(a),
) {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000)
    throw new Error("亂數上限無效");
  const limit = Math.floor(0x100000000 / max) * max;
  let n: number;
  do {
    n = source(new Uint32Array(1))[0];
  } while (n >= limit);
  return n % max;
}
export function shuffle<T>(items: T[], random = randomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function parseList(text: string, max: number): Ticket[] {
  const names = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (names.length > max) throw new Error(`最多 ${max} 項，請減少名單。`);
  if (names.some((x) => [...x].length > 80))
    throw new Error("每項最多 80 個字元。");
  return names.map((name, i) => ({ id: String(i), name }));
}
export function groupTickets(
  items: Ticket[],
  value: number,
  mode: string,
  random = randomInt,
) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    (mode === "count" && value > items.length) ||
    !items.length
  )
    throw new Error("請輸入有效正整數；組數不可超過人數。");
  const count = mode === "count" ? value : Math.ceil(items.length / value);
  const groups: Ticket[][] = Array.from({ length: count }, () => []);
  shuffle(items, random).forEach((item, i) => groups[i % count].push(item));
  return groups;
}
export function wheelAngle(index: number, count: number, current: number) {
  const target = (((360 - ((index + 0.5) * 360) / count) % 360) + 360) % 360;
  return current + 1800 + ((target - (current % 360) + 360) % 360);
}
export function wheelIndex(angle: number, count: number) {
  return Math.floor(
    ((((360 - (angle % 360)) % 360) + 360) % 360) / (360 / count),
  );
}
export function wifiPayload(
  ssid: string,
  password: string,
  auth: string,
  hidden: boolean,
) {
  const esc = (s: string) => s.replace(/[\\;,:\"]/g, "\\$&");
  if (!ssid) throw new Error("請輸入網路名稱。");
  return `WIFI:T:${auth};S:${esc(ssid)};P:${auth === "nopass" ? "" : esc(password)};H:${hidden};;`;
}
export function clockParts(date: Date, zone: string) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Taipei",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  }
  const parts = formatter.formatToParts(date);
  return ["hour", "minute", "second"].map(
    (type) => parts.find((x) => x.type === type)!.value,
  );
}
const letters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const range = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => String.fromCodePoint(start + i)).join(
    "",
  );
const alphabet = (upper: number, lower: number, digit?: number) =>
  range(upper, 26) +
  range(lower, 26) +
  (digit ? range(digit, 10) : "0123456789");
const exceptions = (value: string, map: Record<string, string>) =>
  [...value].map((c, i) => map[letters[i]] ?? c).join("");
export const textStyles = [
  ["粗體", alphabet(0x1d400, 0x1d41a, 0x1d7ce)],
  ["斜體", exceptions(alphabet(0x1d434, 0x1d44e), { h: "ℎ" })],
  ["粗斜體", alphabet(0x1d468, 0x1d482)],
  ["無襯線", alphabet(0x1d5a0, 0x1d5ba, 0x1d7e2)],
  ["無襯線粗體", alphabet(0x1d5d4, 0x1d5ee, 0x1d7ec)],
  ["等寬", alphabet(0x1d670, 0x1d68a, 0x1d7f6)],
  [
    "雙線",
    exceptions(alphabet(0x1d538, 0x1d552, 0x1d7d8), {
      C: "ℂ",
      H: "ℍ",
      N: "ℕ",
      P: "ℙ",
      Q: "ℚ",
      R: "ℝ",
      Z: "ℤ",
    }),
  ],
  [
    "花體",
    exceptions(alphabet(0x1d49c, 0x1d4b6), {
      B: "ℬ",
      E: "ℰ",
      F: "ℱ",
      H: "ℋ",
      I: "ℐ",
      L: "ℒ",
      M: "ℳ",
      R: "ℛ",
      e: "ℯ",
      g: "ℊ",
      o: "ℴ",
    }),
  ],
  [
    "Fraktur",
    exceptions(alphabet(0x1d504, 0x1d51e), {
      C: "ℭ",
      H: "ℌ",
      I: "ℑ",
      R: "ℜ",
      Z: "ℨ",
    }),
  ],
  [
    "小型大寫",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ0123456789",
  ],
  ["圈字", range(0x24b6, 26) + range(0x24d0, 26) + "⓪①②③④⑤⑥⑦⑧⑨"],
  ["全形", alphabet(0xff21, 0xff41, 0xff10)],
] as const;
export function convertText(text: string, map: string) {
  const mapped = [...map];
  return [...text]
    .map((c) => {
      const i = letters.indexOf(c);
      return i < 0 ? c : mapped[i];
    })
    .join("");
}
