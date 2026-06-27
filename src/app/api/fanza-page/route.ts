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

  console.log("URL", page.url());

console.log("TITLE", await page.title());

console.log(await page.content());

  console.log(await page.title());

  await browser.close();

  return Response.json({
    ok: true,
  });
}