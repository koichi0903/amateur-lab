import { Browser, chromium } from "playwright";

export async function createBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
  });
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}