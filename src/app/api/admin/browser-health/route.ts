import { NextResponse } from "next/server";

import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const startedAt = Date.now();
  let browser: Awaited<ReturnType<typeof createBrowser>> | null = null;

  try {
    browser = await createBrowser();
    const page = await browser.newPage();
    await page.goto("data:text/html,<title>browser-ready</title>");

    return NextResponse.json({
      success: true,
      message: "Browser is ready.",
      title: await page.title(),
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[browser-health] failed", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Browser failed to start.",
      },
      { status: 500 },
    );
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
