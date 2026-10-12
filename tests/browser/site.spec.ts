import { test, expect } from "@playwright/test";
const routes = [
  "clock",
  "wheel",
  "groups",
  "draw",
  "coin",
  "emoji",
  "symbols",
  "cool-text",
  "instagram-fonts",
  "qr-code",
];
test("all routes reload, canonical, themes, 320px layout and clean console", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  for (const width of [1366, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["", ...routes, "about", "privacy"]) {
      await page.goto("/" + path);
      await page.reload();
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
        "href",
        "https://tools.pulse-studio.live/" + path,
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  }
  await page
    .getByRole("combobox", { name: "主題", exact: true })
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/mobile-dark.png",
    fullPage: true,
  });
  await page.goto("/");
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: "test-results/home-dark.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("home search category favorite recent and clear scoped storage", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "搜尋工具" }).fill("wifi");
  await expect(page.locator(".tool-card")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "搜尋工具" }).fill("");
  await page.getByRole("button", { name: "隨機與決策", exact: true }).click();
  await expect(page.locator(".tool-card")).toHaveCount(4);
  await page.goBack();
  await page
    .getByRole("button", { name: "收藏線上時鐘", exact: true })
    .first()
    .click();
  await page.goto("/clock");
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pulsetools:recent'))).toContain('clock');
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "我的收藏" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近使用" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("other-app", "keep"));
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "清除本站資料" }).click();
  await expect(page.getByRole("heading", { name: "我的收藏" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("other-app"))).toBe(
    "keep",
  );
});
test("wheel lock, groups, draw, coin reduced motion and text", async ({
  page,
}) => {
  await page.goto("/wheel");
  await page.getByLabel("名單（每行一項）").fill("A\nA\nB");
  await page.getByRole("button", { name: "旋轉轉盤", exact: true }).click();
  await expect(page.getByLabel("名單（每行一項）")).toBeDisabled();
  await expect(page.locator(".history li")).toHaveCount(1, { timeout: 6000 });
  await expect(page.locator(".result")).toContainText(/A|B/);
  await page.goto("/groups");
  await page.getByLabel("名單（每行一項）").fill("A\nA\nB\nC\nD");
  await page.getByRole("button", { name: "隨機分組", exact: true }).click();
  await expect(page.locator(".group-results li")).toHaveCount(5);
  await expect(page.locator(".group-results section")).toHaveCount(2);
  await page.goto("/draw");
  await page.getByLabel("名單（每行一項）").fill("A\nA\nB");
  await page.getByRole("button", { name: "開始抽籤" }).click();
  await expect(page.locator(".ticket-back")).toHaveCount(3);
  await expect(page.locator(".draw-grid")).not.toContainText("A");
  await page.getByRole("button", { name: "抽一張", exact: true }).click();
  await expect(page.locator(".revealed")).toHaveCount(1);
  await page.getByLabel("一次抽幾張").fill("2");
  await page.getByRole("button", { name: "抽 N 張" }).click();
  await expect(page.locator(".revealed")).toHaveCount(3);
  await expect(page.locator(".history li")).toHaveCount(3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/coin");
  await page.getByRole("button", { name: "拋擲硬幣" }).click();
  await expect(page.locator(".stats strong").first()).toHaveText("1");
  await page.goto("/cool-text");
  await page.getByLabel("輸入文字").fill("中文👩‍💻 CH");
  await expect(page.locator(".text-row")).toHaveCount(12);
  await expect(page.locator(".converted").first()).toContainText("中文👩‍💻");
});
test("emoji full search, skins and symbol copy failure fallback", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/emoji");
  await page.getByLabel("搜尋名稱或關鍵字").fill("Taiwan");
  await expect(page.locator(".symbol-grid button").first()).toBeVisible();
  await page.locator(".symbol-grid button").first().click();
  await expect(page.locator(".selected-symbol")).toHaveText("🇹🇼");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("🇹🇼");
  await page.getByLabel("搜尋名稱或關鍵字").fill("thumbs up");
  await page.locator(".symbol-grid button").first().click();
  await expect(page.getByLabel("膚色")).toBeVisible();
  await page.goto("/symbols");
  await page.addScriptTag({
    content:
      "Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))}})",
  });
  await page.locator(".symbol-grid button").first().click();
  await expect(page.getByLabel("手動複製符號")).toBeVisible();
});
test("QR output tracks input and invalid state disables downloads", async ({
  page,
}) => {
  await page.goto("/qr-code");
  await page.getByLabel("內容類型").selectOption("text");
  await page.getByLabel("文字內容", { exact: true }).fill("繁體中文 👩‍💻");
  await expect(
    page.getByRole("img", { name: "目前內容的 QR Code" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "下載 PNG" })).toBeEnabled();
  const old = await page.locator(".qr-image img").getAttribute("src");
  await page.getByLabel("文字內容", { exact: true }).fill("新內容");
  await expect
    .poll(() => page.locator(".qr-image img").getAttribute("src"))
    .not.toBe(old);
  await page.getByLabel("文字內容", { exact: true }).fill("");
  await expect(page.getByRole("button", { name: "下載 PNG" })).toBeDisabled();
  await expect(page.locator(".qr-image img")).toHaveCount(0);
});
test("clock four styles, fallback Esc touch and native fullscreen", async ({
  page,
}) => {
  await page.goto("/clock");
  for (const style of ["minimal", "led", "flip", "analog"]) {
    await page.getByLabel("時鐘樣式").selectOption(style);
    await expect(page.locator(".clock-stage")).toHaveClass(new RegExp(style));
  }
  await page.evaluate(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("denied"));
  });
  await page.getByRole("button", { name: "進入全螢幕" }).click();
  await expect(page.locator(".presentation")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".presentation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "進入全螢幕" })).toBeFocused();
  await page.getByRole("button", { name: "進入全螢幕" }).click();
  await page.locator(".clock-stage").click();
  await expect(page.locator(".presentation")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "進入全螢幕" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!document.fullscreenElement ||
          !!document.querySelector(".presentation"),
      ),
    )
    .toBe(true);
  await page.locator(".clock-stage").click();
});
test("corrupt and unavailable local storage does not break tools; unknown route 404", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("pulsetools:favorites", "{broken");
    localStorage.setItem("pulsetools:clock", '"wrong"');
  });
  await page.goto("/");
  await expect(page.locator(".tool-card")).toHaveCount(10);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    Storage.prototype.getItem = () => {
      throw new Error("denied");
    };
  });
  await page.goto("/clock");
  await expect(page.locator(".digits")).toBeVisible();
  const response = await page.goto("/no-such-route");
  expect(response?.status()).toBe(404);
});
