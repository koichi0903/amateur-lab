import { Browser, chromium } from "playwright";

export async function createBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
    ],
  });
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}