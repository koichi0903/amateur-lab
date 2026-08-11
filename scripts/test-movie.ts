import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  // mp4を監視
  let sampleMovieUrl: string | null = null;

page.on("response", (response) => {
  const url = response.url();

  if (
    url.endsWith(".mp4") &&
    sampleMovieUrl === null
  ) {
    sampleMovieUrl = url;
  }
});

  // 年齢確認
  await page.goto("https://www.dmm.co.jp/top/");

  try {
    await page.getByRole("link", { name: "はい" }).click({
      timeout: 3000,
    });
  } catch {}

  // 調査したい作品
  await page.goto(
    "https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=mida00716/"
  );

  console.log("作品ページを開きました");

  // 動画を再生するまで待つ
  await page.waitForTimeout(60000);

  console.log("");
console.log("取得した動画URL");
console.log(sampleMovieUrl);
console.log("");

  await browser.close();
}

main();