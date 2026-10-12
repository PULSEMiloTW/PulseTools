import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "@playwright/test";
const base = "https://tools.pulse-studio.live";
fs.mkdirSync("artifacts", { recursive: true });
const routes = [
  "",
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
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage();
const bad = [];
page.on("response", (r) => {
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
});
page.on("pageerror", (e) => bad.push(e.message));
for (const route of routes) {
  const response = await page.goto(base + "/" + route);
  assert.equal(response.status(), 200);
  await page.reload();
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(
    await page.locator("link[rel=canonical]").getAttribute("href"),
    base + "/" + route,
  );
  console.log(route || "/", 200);
}
assert.deepEqual(bad, []);
const sitemap = await (await fetch(base + "/sitemap.xml")).text();
for (const route of routes) assert.ok(sitemap.includes(base + "/" + route));
const http = await fetch("http://tools.pulse-studio.live/clock?source=smoke", {
  redirect: "manual",
});
console.log("HTTP redirect", http.status, http.headers.get("location"));
const pages = await fetch("https://pulsetools.pages.dev/clock?source=smoke", {
  redirect: "manual",
});
console.log(
  "pages.dev",
  pages.status,
  pages.headers.get("location"),
  pages.headers.get("x-robots-tag"),
);
const missing = await page.goto(base + "/this-route-does-not-exist");
assert.equal(missing.status(), 404);
await page.goto(base + "/");
await page.setViewportSize({ width: 1366, height: 900 });
await page.screenshot({
  path: "artifacts/production-home.png",
  fullPage: true,
});
await page.goto(base + "/wheel");
await page.screenshot({
  path: "artifacts/production-wheel.png",
  fullPage: true,
});
await page.getByLabel("名單（每行一項）").fill("A\nB\nC");
await page.getByRole("button", { name: "旋轉轉盤", exact: true }).click();
await page.locator(".history li").waitFor();
await page.goto(base + "/qr-code");
await page.getByLabel("內容類型").selectOption("text");
await page.getByLabel("文字內容", { exact: true }).fill("正式網站 QR 驗證 👩‍💻");
await page.locator(".qr-image img").waitFor();
assert.ok(await page.getByRole("button", { name: "下載 PNG" }).isEnabled());
await page.screenshot({ path: "artifacts/production-qr.png", fullPage: true });
await page.goto(base + "/");
await page.setViewportSize({ width: 320, height: 900 });
await page.screenshot({
  path: "artifacts/production-mobile.png",
  fullPage: true,
});
await browser.close();
console.log("PUBLIC SMOKE PASSED");
