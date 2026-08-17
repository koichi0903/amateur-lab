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

type SelectorWaitOptions = {
  attempts?: number;
  minimumCount?: number;
  timeoutMs?: number;
  settleMs?: number;
  label?: string;
};

export async function openFanzaPageWithSelector(
  page: Page,
  url: string,
  selector: string,
  options: SelectorWaitOptions = {},
): Promise<number> {
  const {
    attempts = 3,
    minimumCount = 1,
    timeoutMs = 20_000,
    settleMs = 500,
    label = "content",
  } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await openFanzaPage(page, url);
      await page.waitForFunction(
        ({ targetSelector, requiredCount }) =>
          document.querySelectorAll(targetSelector).length >= requiredCount,
        { targetSelector: selector, requiredCount: minimumCount },
        { timeout: timeoutMs },
      );
      await page.waitForTimeout(settleMs);

      const count = await page.locator(selector).count();
      if (count >= minimumCount) return count;

      lastError = new Error(
        `expected at least ${minimumCount} elements but found ${count}`,
      );
    } catch (error) {
      lastError = error;
    }

    console.warn(
      `[fanza-${label}] retry ${attempt}/${attempts}: ${url}`,
      lastError,
    );
  }

  const reason =
    lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(
    `FANZA ${label} page could not be loaded after ${attempts} attempts: ${url} (${reason})`,
  );
}

export async function openFanzaContentListPage(
  page: Page,
  url: string,
  attempts = 3,
): Promise<number> {
  return openFanzaPageWithSelector(page, url, CONTENT_CARD_SELECTOR, {
    attempts,
    label: "list",
  });
}
