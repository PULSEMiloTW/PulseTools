import { test } from "node:test";
import assert from "node:assert/strict";
import {
  randomInt,
  shuffle,
  parseList,
  groupTickets,
  wheelAngle,
  wheelIndex,
  wifiPayload,
  clockParts,
  textStyles,
  convertText,
} from "../src/lib/core";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import emoji from "emojibase-data/zh-hant/data.json";
test("random boundaries and rejection sampling", () => {
  let calls = 0;
  assert.equal(
    randomInt(3, (a) => {
      a[0] = calls++ === 0 ? 0xffffffff : 5;
      return a;
    }),
    2,
  );
  assert.equal(calls, 2);
  for (const n of [0, -1, 1.2, NaN, 0x100000001])
    assert.throws(() => randomInt(n));
  assert.equal(
    randomInt(1, (a) => {
      a[0] = 0xffffffff;
      return a;
    }),
    0,
  );
});
test("IDs survive duplicate names, shuffle, balanced groups and size limit", () => {
  const list = parseList(" A \n\nA\nB\nC\nD", 100);
  assert.equal(list.length, 5);
  assert.equal(new Set(list.map((x) => x.id)).size, 5);
  assert.deepEqual(
    shuffle(list, () => 0)
      .map((x) => x.id)
      .sort(),
    list.map((x) => x.id).sort(),
  );
  for (const mode of ["count", "size"]) {
    const groups = groupTickets(list, 2, mode, () => 0);
    const sizes = groups.map((x) => x.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    assert.equal(new Set(groups.flat().map((x) => x.id)).size, 5);
    if (mode === "size") assert.ok(Math.max(...sizes) <= 2);
  }
  assert.throws(() => groupTickets(list, 6, "count"));
  assert.throws(() => parseList("x\n".repeat(101), 100));
  assert.throws(() => parseList("😀".repeat(81), 100));
});
test("draw cards have immutable IDs and do not replace revealed tickets", () => {
  const cards = shuffle(parseList("A\nA\nB", 200), () => 0);
  const revealed = new Set<string>();
  for (const card of cards) {
    assert.ok(!revealed.has(card.id));
    revealed.add(card.id);
  }
  assert.equal(revealed.size, 3);
  assert.equal(cards.filter((x) => !revealed.has(x.id)).length, 0);
});
test("wheel pointer matches predetermined winner at 2,3,100 and crossing zero", () => {
  for (const count of [2, 3, 100])
    for (const current of [0, 359, 360, 1859, 7200])
      for (let i = 0; i < count; i++)
        assert.equal(wheelIndex(wheelAngle(i, count, current), count), i);
});
test("Unicode exceptions and original Chinese/ZWJ survive", () => {
  const maps = new Map(textStyles);
  assert.equal(convertText("CHNPQRZ", maps.get("雙線")!), "ℂℍℕℙℚℝℤ");
  assert.equal(convertText("BEFHILMRego", maps.get("花體")!), "ℬℰℱℋℐℒℳℛℯℊℴ");
  assert.equal(convertText("CHIRZ", maps.get("Fraktur")!), "ℭℌℑℜℨ");
  assert.equal(convertText("h", maps.get("斜體")!), "ℎ");
  for (const [, map] of textStyles) {
    assert.equal([...map].length, 62);
    assert.equal(convertText("中文👩‍💻\n🇹🇼", map), "中文👩‍💻\n🇹🇼");
  }
  assert.ok(emoji.some((x) => x.emoji === "👩‍💻"));
  assert.ok(emoji.some((x) => x.emoji === "🇹🇼"));
  assert.ok(emoji.some((x) => x.skins?.length));
});
test("clock handles midnight, DST and invalid zones consistently", () => {
  assert.deepEqual(
    clockParts(new Date("2026-01-01T16:00:01Z"), "Asia/Taipei"),
    ["00", "00", "01"],
  );
  assert.deepEqual(
    clockParts(new Date("2026-03-08T06:59:59Z"), "America/New_York"),
    ["01", "59", "59"],
  );
  assert.deepEqual(
    clockParts(new Date("2026-03-08T07:00:00Z"), "America/New_York"),
    ["03", "00", "00"],
  );
  assert.deepEqual(clockParts(new Date("2026-01-01T16:00:01Z"), "invalid"), [
    "00",
    "00",
    "01",
  ]);
});
test("Wi-Fi escaping preserves reserved characters", () => {
  assert.equal(
    wifiPayload('a;:,"\\', 'p;:,"\\', "WPA", true),
    'WIFI:T:WPA;S:a\\;\\:\\,\\"\\\\;P:p\\;\\:\\,\\"\\\\;H:true;;',
  );
  assert.equal(
    wifiPayload("open", "secret", "nopass", false),
    "WIFI:T:nopass;S:open;P:;H:false;;",
  );
});
test("independent PNG decoder matches URL, Chinese, and Wi-Fi; SVG quiet zone", async () => {
  for (const payload of [
    "https://example.com/繁體中文?名稱=測試",
    "繁體中文 👩‍💻\n原文不改",
    wifiPayload("脈動;網路", '密碼:,"\\', "WPA", true),
  ]) {
    const png = PNG.sync.read(
      await QRCode.toBuffer(payload, {
        margin: 4,
        scale: 8,
        errorCorrectionLevel: "M",
      }),
    );
    const decoded = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    assert.equal(decoded?.data, payload);
    const svg = await QRCode.toString(payload, { type: "svg", margin: 4 });
    assert.ok(svg.startsWith("<svg"));
    const modules = QRCode.create(payload).modules.size;
    assert.ok(svg.includes(`viewBox="0 0 ${modules + 8} ${modules + 8}"`));
  }
  assert.throws(() =>
    QRCode.create("繁".repeat(4000), { errorCorrectionLevel: "H" }),
  );
});
