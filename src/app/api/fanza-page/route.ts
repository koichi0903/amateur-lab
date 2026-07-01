import { chromium } from "playwright";

export async function GET() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://video.dmm.co.jp/av/content/?id=h_491mspk01601",
    {
      waitUntil: "domcontentloaded",
    }
  );

  await browser.close();

  return Response.json({
    ok: true,
  });
}