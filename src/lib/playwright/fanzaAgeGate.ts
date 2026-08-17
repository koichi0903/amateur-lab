import type { Page } from "playwright-core";

const FANZA_AGE_COOKIES = [
  {
    name: "age_check_done",
    value: "1",
    domain: ".dmm.co.jp",
    path: "/",
    secure: true,
    sameSite: "Lax" as const,
  },
  {
    name: "ckcy",
    value: "1",
    domain: ".dmm.co.jp",
    path: "/",
    secure: true,
    sameSite: "Lax" as const,
  },
];

export async function openFanzaPage(page: Page, url: string) {
  // These cookies must exist before the first request. The age-gate button
  // is not a stable API and its markup can change without notice.
  await page.context().addCookies(FANZA_AGE_COOKIES);
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  if (page.url().includes("/age_check/")) {
    await page.context().addCookies(FANZA_AGE_COOKIES);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  }

  if (page.url().includes("/age_check/")) {
    throw new Error(`FANZA age verification could not be bypassed: ${url}`);
  }
}

const CONTENT_CARD_SELECTOR = '[data-e2eid="content-card"]';

export async function openFanzaContentListPage(
  page: Page,
  url: string,
  attempts = 3,
): Promise<number> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await openFanzaPage(page, url);
      await page.locator(CONTENT_CARD_SELECTOR).first().waitFor({
        state: "visible",
        timeout: 20_000,
      });
      await page.waitForTimeout(500);

      const count = await page.locator(CONTENT_CARD_SELECTOR).count();
      if (count > 0) return count;

      lastError = new Error("FANZA content list returned zero cards");
    } catch (error) {
      lastError = error;
    }

    console.warn(
      `[fanza-list] retry ${attempt}/${attempts}: ${url}`,
      lastError,
    );
  }

  const reason =
    lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(
    `FANZA list page could not be loaded after ${attempts} attempts: ${url} (${reason})`,
  );
}
