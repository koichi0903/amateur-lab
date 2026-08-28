/**
 * Playwright 年齢認証処理
 *
 * 完成済（2026-07-07）
 *
 * このファイルは発掘LAB v1.0の正式実装です。
 * 年齢認証処理は確認済みのため、原則修正禁止。
 */

import type { Browser } from "playwright-core";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { parsePage } from "./parser";
import { saveWork } from "./save";

export type PlaywrightUpdateResult =
  | "updated"
  | "unavailable";

export type PlaywrightUpdateOptions = {
  captureSampleMovie?: boolean;
};

const UNAVAILABLE_STATUS_PATTERN =
  /^UNAVAILABLE_(\d+)_([0-9]{8})_(RESERVED|NEW|SEMI_NEW|OLD)$/;

function japanDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}${value("month")}${value("day")}`;
}

async function recordUnavailable(productId: string): Promise<void> {
  const dmmItem = await getDmmItem(productId);
  if (dmmItem) {
    throw new Error(
      `FANZA page returned no prices while DMM API still has ${productId}`,
    );
  }

  const { data: work, error } = await supabase
    .from("works")
    .select("stage,playwright_status")
    .eq("product_id", productId)
    .single();
  if (error) throw error;

  const today = japanDateKey();
  const currentStatus = work.playwright_status ?? "";
  const match = currentStatus.match(UNAVAILABLE_STATUS_PATTERN);
  const originalStage =
    match?.[3] ??
    (work.stage === "DISCONTINUED" ? "OLD" : work.stage ?? "OLD");

  if (currentStatus.startsWith("DISCONTINUED_")) {
    const { error: touchError } = await supabase
      .from("works")
      .update({ updated_at: new Date().toISOString() })
      .eq("product_id", productId);
    if (touchError) throw touchError;
    return;
  }

  const previousCount = Number(match?.[1] ?? 0);
  const previousDate = match?.[2] ?? "";
  const nextCount = previousDate === today ? previousCount : previousCount + 1;
  const discontinued = nextCount >= 3;
  const nextStatus = discontinued
    ? `DISCONTINUED_${today}_${originalStage}`
    : `UNAVAILABLE_${nextCount}_${today}_${originalStage}`;

  const { error: updateError } = await supabase
    .from("works")
    .update({
      playwright_status: nextStatus,
      ...(discontinued
        ? {
            stage: "DISCONTINUED",
            is_on_sale: false,
            sale_price: null,
            discount_rate: 0,
            sale_end_at: null,
          }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("product_id", productId);
  if (updateError) throw updateError;

  console.log(
    discontinued
      ? `[DISCONTINUED] ${productId} confirmed on 3 separate days`
      : `[UNAVAILABLE] ${productId} confirmation ${nextCount}/3`,
  );
}

export async function updatePlaywrightItem(
  productId: string,
  url?: string | null,
  browser?: Browser,
  listPrice?: number | null,
  options: PlaywrightUpdateOptions = {},
): Promise<PlaywrightUpdateResult>
{
  const captureSampleMovie = options.captureSampleMovie === true;
  let workUrl: string | undefined =
  url ?? undefined;

if (!workUrl) {
  const { data: work, error } = await supabase
    .from("works")
    .select("url")
    .eq("product_id", productId)
    .single();

  if (error) {
    console.log("作品情報が見つかりません:", productId);
    return "unavailable";
  }

  workUrl ??= work?.url ?? undefined;

  if (!workUrl) {
    console.log("URLが見つかりません:", productId);
    return "unavailable";
  }
}

  // Serverless Chromium can exit after its last page closes. Treat a passed,
  // disconnected instance like no browser so the next item can recover.
  let ownBrowser = !browser || !browser.isConnected();

  if (!browser?.isConnected()) {
    console.warn(`[browser] recreating disconnected Chromium for ${productId}`);
    browser = await createBrowser();
  }

  let page;

  try {
    page = await browser.newPage();
  } catch (error) {
    // The disconnected event may arrive just after isConnected() was checked.
    // Retry once with a fresh process instead of failing the whole update job.
    if (browser.isConnected()) throw error;

    console.warn(`[browser] newPage failed after disconnect; retrying ${productId}`);
    browser = await createBrowser();
    ownBrowser = true;
    page = await browser.newPage();
  }

  // Routine updates never need video traffic. Initial registration explicitly
  // opts in so the sample URL can be captured once and then kept unchanged.
  if (process.env.VERCEL || !captureSampleMovie) {
    await page.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();
      const requestUrl = route.request().url();

      if (
        (process.env.VERCEL && (resourceType === "image" || resourceType === "font")) ||
        (!captureSampleMovie &&
          (resourceType === "media" || /\.mp4(?:$|\?)/i.test(requestUrl)))
      ) {
        await route.abort();
        return;
      }

      await route.continue();
    });
  }

  let sampleMovieUrl: string | null = null;
  let resolveSampleMovie: ((url: string) => void) | null = null;
  const sampleMovieDetected = captureSampleMovie
    ? new Promise<string>((resolve) => {
        resolveSampleMovie = resolve;
      })
    : null;

  if (captureSampleMovie) {
    page.on("response", (response) => {
      const responseUrl = response.url();

      if (/\.mp4(?:$|\?)/i.test(responseUrl) && sampleMovieUrl === null) {
        sampleMovieUrl = responseUrl;
        resolveSampleMovie?.(responseUrl);
        console.log(`[MP4_INITIAL] ${productId} ${sampleMovieUrl}`);
      }
    });
  }

  try {

    if (!workUrl) {
  console.log("URLが見つかりません:", productId);
  return "unavailable";
}
    // Mark the browser context as age-confirmed before the first request.
    // Following the English age-gate link redirects serverless visitors to
    // account login, while the same cookie is used by the normal storefront.
    await page.context().addCookies([
      {
        name: "age_check_done",
        value: "1",
        domain: ".dmm.co.jp",
        path: "/",
        secure: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto(workUrl, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});



    if (page.url().includes("/age_check/")) {
      await page.context().addCookies([
        {
          name: "age_check_done",
          value: "1",
          domain: ".dmm.co.jp",
          path: "/",
          secure: true,
          sameSite: "Lax",
        },
      ]);
      await page.goto(workUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      if (page.url().includes("/age_check/")) {
        throw new Error(`年齢認証ページを回避できませんでした: ${productId}`);
      }

      console.log(`[INFO] ${productId} 年齢認証Cookieで商品ページを再読込`);
    } else {
      console.log(`[INFO] ${productId} 年齢認証Cookieを確認`);
    }

    // The product page hydrates after DOMContentLoaded. Waiting for its pricing
    // controls also gives an initial sample player time to attach.
    await page
      .locator("label")
      .first()
      .waitFor({ state: "attached", timeout: 15_000 })
      .catch(() => undefined);

    if (captureSampleMovie && !sampleMovieUrl) {
      const video = page.locator("video").first();
      const hasVideo = await video
        .waitFor({ state: "attached", timeout: 2_500 })
        .then(() => true)
        .catch(() => false);

      const directMovieUrl = await page
        .evaluate(() => {
          const candidates = [
            ...Array.from(document.querySelectorAll("video"), (node) =>
              node.getAttribute("src"),
            ),
            ...Array.from(document.querySelectorAll("video source"), (node) =>
              node.getAttribute("src"),
            ),
          ];
          return (
            candidates.find(
              (value): value is string =>
                Boolean(value && /^https?:/i.test(value) && /\.mp4(?:$|\?)/i.test(value)),
            ) ?? null
          );
        })
        .catch(() => null);

      if (directMovieUrl) {
        sampleMovieUrl = directMovieUrl;
        console.log(`[MP4_INITIAL_DOM] ${productId} ${directMovieUrl}`);
      } else if (hasVideo) {
        await video
          .evaluate((element) => (element as HTMLVideoElement).play())
          .catch(() => undefined);
      }

      if (!sampleMovieUrl && sampleMovieDetected) {
        await Promise.race([
          sampleMovieDetected,
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), hasVideo ? 5_000 : 2_000),
          ),
        ]);
      }

      if (sampleMovieUrl) {
        const { error: sampleMovieError } = await supabase
          .from("works")
          .update({ sample_movie_url: sampleMovieUrl })
          .eq("product_id", productId)
          .is("sample_movie_url", null);
        if (sampleMovieError) throw sampleMovieError;

        console.log(`[SAMPLE_MOVIE_INITIAL_SAVED] ${productId}`);
      } else {
        console.log(`[SAMPLE_MOVIE_INITIAL_MISSING] ${productId}`);
      }
    }

    const data = await parsePage(page);

// 価格取得失敗なら保存しない
if (data.prices.length === 0) {
  const diagnostics = await page
    .evaluate(() => ({
      url: window.location.href,
      title: document.title,
      labelCount: document.querySelectorAll("label").length,
      contentPriceCount: document.querySelectorAll(
        '[data-e2eid="content-price"]'
      ).length,
      bodyText: document.body?.innerText
        ?.replace(/\s+/g, " ")
        .trim()
        .slice(0, 500),
    }))
    .catch((error) => ({
      diagnosticError:
        error instanceof Error ? error.message : String(error),
    }));

  console.log(`[PRICE_DIAGNOSTICS] ${productId}`, diagnostics);
  console.log(
    `[SKIP] ${productId} prices=[] url=${workUrl}`
  );

  // An unavailable/removed FANZA page was still checked successfully. Move its
  // timestamp forward so the oldest-first local batch does not select the same
  // 404 product again on every run.
  await recordUnavailable(productId);

  console.log(`[CHECKED] FANZA利用不可 ${productId}`);
  return "unavailable";
}

let saved = false;
let lastSaveError: unknown = null;

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
await saveWork(
  productId,
  data,
  listPrice
);

saved = true;
break;
  } catch (error) {
    lastSaveError = error;

    console.error(
      `[ERROR] saveWork失敗 (${attempt}/3) ${productId}`,
      error
    );

    if (attempt < 3) {
      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );
    }
  }
}

if (!saved) {
  console.error(
    `[SKIP] saveWorkを3回試行しましたが失敗しました: ${productId}`
  );

  throw lastSaveError instanceof Error
    ? lastSaveError
    : new Error(
        `saveWorkを3回試行しましたが失敗しました: ${productId}`
      );
}

console.log(
  `[OK] ${productId} 更新完了`
);
return "updated";
  } finally {
  try {
    await page.close();
  } catch (e) {
    console.error("page.close失敗", e);
  }

  if (ownBrowser) {
    await browser.close();
  }
}
}
