import "server-only";

import type { APIResponse, Browser, Page } from "playwright-core";
import { isOfficialFanzaDmmSampleUrl } from "@/lib/xMediaAssets";
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

type CaptureOptions = { navigationTimeoutMs?: number; playerTimeoutMs?: number; mediaWaitTimeoutMs?: number };

async function withCapturedFanzaSampleMovie<T>(
  productUrl: string,
  browser: Browser,
  options: CaptureOptions,
  consume: (page: Page, movieUrl: string) => Promise<T>,
): Promise<T | null> {
  if (!isAllowedFanzaProductUrl(productUrl)) throw new Error("公式DMM/FANZAの商品ページURLではありません。");

  const navigationTimeoutMs = options.navigationTimeoutMs ?? 60_000;
  const mediaWaitTimeoutMs = options.mediaWaitTimeoutMs ?? 15_000;
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
    await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });

    if (page.url().includes("/age_check/")) {
      await page.context().addCookies([{
        name: "age_check_done",
        value: "1",
        domain: ".dmm.co.jp",
        path: "/",
        secure: true,
        sameSite: "Lax",
      }]);
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
      if (page.url().includes("/age_check/")) throw new Error("年齢確認後の商品ページを開けませんでした。");
    }

    // DMM has changed its embedded-player iframe paths over time. Do not use
    // one iframe URL pattern to shorten the media-detection window.
    const candidate = await watcher.waitForUrl(mediaWaitTimeoutMs);
    if (!candidate) {
      const frameStates = await Promise.all(page.frames().map((frame) => frame.evaluate(() => {
        const videos = Array.from(document.querySelectorAll("video"));
        return {
          videoCount: videos.length,
          sourcedVideoCount: videos.filter((video) => Boolean(video.currentSrc || video.getAttribute("src"))).length,
          playingVideoCount: videos.filter((video) => !video.paused).length,
        };
      }).catch(() => ({ videoCount: 0, sourcedVideoCount: 0, playingVideoCount: 0 }))));
      let pageLocation: { host: string; path: string } | null = null;
      try {
        const pageUrl = new URL(page.url());
        pageLocation = { host: pageUrl.hostname, path: pageUrl.pathname };
      } catch {
        pageLocation = null;
      }
      console.warn("[fanza-sample] player media URL not detected", {
        pageLocation,
        frameCount: page.frames().length,
        iframeCount: await page.locator("iframe").count().catch(() => 0),
        videoCount: frameStates.reduce((total, frame) => total + frame.videoCount, 0),
        sourcedVideoCount: frameStates.reduce((total, frame) => total + frame.sourcedVideoCount, 0),
        playingVideoCount: frameStates.reduce((total, frame) => total + frame.playingVideoCount, 0),
      });
      return null;
    }
    if (!MP4_URL_PATTERN.test(candidate)) throw new Error("プレイヤーからMP4形式のURLを確認できませんでした。");
    if (!isOfficialFanzaDmmSampleUrl(candidate)) throw new Error("公式DMM/FANZA以外の動画URLを検出したため停止しました。");
    return await consume(page, candidate);
  } finally {
    watcher.stop();
    await page.close().catch(() => undefined);
  }
}

/** Capture the official MP4 URL from a DMM/FANZA sample player without writing to the actress catalog. */
export async function captureFanzaSampleMovieUrl(
  productUrl: string,
  browser: Browser,
  options: CaptureOptions = {},
): Promise<string | null> {
  return withCapturedFanzaSampleMovie(productUrl, browser, options, async (_page, movieUrl) => movieUrl);
}

export class FanzaSampleFetchError extends Error {
  constructor(readonly httpStatus: number | null, message: string) {
    super(message);
    this.name = "FanzaSampleFetchError";
  }
}

/** Capture and fetch the sample in the same Playwright context so the official host receives its page referrer and session cookies. */
export async function captureFanzaSampleMovieAsset(
  productUrl: string,
  browser: Browser,
  options: CaptureOptions & { maxBytes: number; requestTimeoutMs?: number },
): Promise<{ url: string; bytes: Buffer } | null> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) throw new Error("サンプル動画の容量上限が不正です。");

  return withCapturedFanzaSampleMovie(productUrl, browser, options, async (page, capturedUrl) => {
    const userAgent = await page.evaluate(() => navigator.userAgent);
    let currentUrl = capturedUrl;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      if (!isOfficialFanzaDmmSampleUrl(currentUrl)) throw new FanzaSampleFetchError(null, "公式DMM/FANZA以外への転送を検出したため停止しました。");
      let response: APIResponse;
      try {
        response = await page.request.get(currentUrl, {
          timeout: options.requestTimeoutMs ?? 25_000,
          maxRedirects: 0,
          headers: {
            Accept: "video/mp4,video/*;q=0.9,application/octet-stream;q=0.8,*/*;q=0.5",
            Referer: page.url(),
            "User-Agent": userAgent,
          },
        });
      } catch {
        throw new FanzaSampleFetchError(null, "公式サンプル動画を取得できませんでした。");
      }

      const status = response.status();
      const headers = response.headers();
      const location = headers.location;
      if (status >= 300 && status < 400 && location) {
        await response.dispose().catch(() => undefined);
        if (redirects >= 3) throw new FanzaSampleFetchError(status, "公式サンプル動画の転送回数が上限を超えました。");
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok()) {
        await response.dispose().catch(() => undefined);
        throw new FanzaSampleFetchError(status, `公式サンプル動画を取得できませんでした（HTTP ${status}）。`);
      }

      const contentType = headers["content-type"] ?? "";
      const declaredSize = Number(headers["content-length"]);
      if (contentType && !/video|mp4|octet-stream/i.test(contentType)) {
        await response.dispose().catch(() => undefined);
        throw new FanzaSampleFetchError(status, "動画形式ではない応答が返りました。");
      }
      if (Number.isFinite(declaredSize) && declaredSize > options.maxBytes) {
        await response.dispose().catch(() => undefined);
        throw new FanzaSampleFetchError(status, "元動画が設定した容量上限を超えています。");
      }

      try {
        const bytes = await response.body();
        if (bytes.byteLength > options.maxBytes) throw new FanzaSampleFetchError(status, "元動画が設定した容量上限を超えています。");
        if (status === 206) {
          const contentRange = headers["content-range"] ?? "";
          const totalMatch = /\/(\d+)$/.exec(contentRange);
          if (!totalMatch || Number(totalMatch[1]) > bytes.byteLength) {
            throw new FanzaSampleFetchError(status, "公式サンプル動画が部分応答だったため、完全な動画を取得できませんでした。");
          }
        }
        return { url: capturedUrl, bytes };
      } finally {
        await response.dispose().catch(() => undefined);
      }
    }
    throw new FanzaSampleFetchError(null, "公式サンプル動画の取得を完了できませんでした。");
  });
}

