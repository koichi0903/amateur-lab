import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";

export async function GET() {
  let browser: Awaited<ReturnType<typeof createBrowser>> | null = null;

  try {
    browser = await createBrowser();
    const page = await browser.newPage();
    await page.context().addCookies([
      {
        name: "age_check_done",
        value: "1",
        domain: ".dmm.co.jp",
        path: "/",
      },
    ]);

    const response = await page.goto(
      "https://video.dmm.co.jp/av/content/?id=h_491mspk01601",
      {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      }
    );

    return Response.json({
      ok: response?.ok() ?? false,
      status: response?.status() ?? null,
      hostname: new URL(page.url()).hostname,
      title: await page.title(),
    });
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
