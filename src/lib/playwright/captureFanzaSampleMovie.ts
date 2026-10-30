import "server-only";

import type { Browser } from "playwright-core";
import { watchSampleMovie } from "@/lib/playwright/sampleMovie";

const MP4_URL_PATTERN = /^https?:\/\/.+\.mp4(?:$|[?#])/i;

function isAllowedFanzaProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const allowed = ["dmm.co.jp", "dmm.com", "fanza.co.jp"];
    return url.protocol === "https:" && allowed.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/** Capture the official MP4 URL from a DMM/FANZA sample player without writing to the actress catalog. */
export async function captureFanzaSampleMovieUrl(productUrl: string, browser: Browser): Promise<string | null> {
  if (!isAllowedFanzaProductUrl(productUrl)) throw new Error("公式DMM/FANZAの商品ページURLではありません。");

  const page = await browser.newPage();
  const watcher = watchSampleMovie(page);
  try {
    await page.route("**/*", async (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "font" || type === "stylesheet") {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.context().addCookies([{
      name: "age_check_done",
      value: "1",
      domain: ".dmm.co.jp",
      path: "/",
      secure: true,
      sameSite: "Lax",
    }]);
    await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

    if (page.url().includes("/age_check/")) {
      await page.context().addCookies([{
        name: "age_check_done",
        value: "1",
        domain: ".dmm.co.jp",
        path: "/",
        secure: true,
        sameSite: "Lax",
      }]);
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      if (page.url().includes("/age_check/")) throw new Error("年齢確認後の商品ページを開けませんでした。");
    }

    const hasPlayer = await page.locator('iframe[src*="/html5_player/"]').first()
      .waitFor({ state: "attached", timeout: 8_000 }).then(() => true).catch(() => false);
    const candidate = await watcher.waitForUrl(hasPlayer ? 7_000 : 1_000);
    if (!candidate) return null;
    if (!MP4_URL_PATTERN.test(candidate)) throw new Error("プレイヤーからMP4形式のURLを確認できませんでした。");
    return candidate;
  } finally {
    watcher.stop();
    await page.close().catch(() => undefined);
  }
}
