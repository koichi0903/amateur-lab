import "dotenv/config";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

async function main() {
  const bundledPath = await chromium.executablePath();
  const executablePath = process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : bundledPath;
  const browser = await playwrightChromium.launch({
    executablePath,
    headless: true,
    args: chromium.args,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const adminResponse = await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("link", { name: /myfans X運用/ }).click();
  await page.waitForURL("**/admin/myfans?media=1", { timeout: 30_000 });
  const response = await page.waitForLoadState("networkidle", { timeout: 60_000 }).then(() => page.goto(page.url(), { waitUntil: "networkidle", timeout: 60_000 }));
  const bodyText = await page.locator("body").innerText({ timeout: 30_000 });
  const hasInternal = bodyText.includes("内部判断");
  const hasPublic = bodyText.includes("Xに投稿する本文");
  const hasCommandCenter = bodyText.includes("Daily Growth Command Center");
  const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  await page.screenshot({ path: "C:/Users/DELL/Documents/Codex/2026-09-08/referenced-chatgpt-conversation-this-is-an-10/outputs/myfans-daily-growth-command-center-v4.png", fullPage: true });
  await browser.close();
  console.log(JSON.stringify({
    status: response?.status() ?? null,
    adminStatus: adminResponse?.status() ?? null,
    finalUrl: page.url(),
    hasCommandCenter,
    hasInternal,
    hasPublic,
    consoleErrors,
    pageErrors,
    hasHorizontalScroll,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
