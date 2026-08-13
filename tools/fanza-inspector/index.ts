import { chromium } from "playwright-core";
import fs from "fs/promises";
import path from "path";
import { parsePage } from "../../src/lib/playwright/parser";
import { saveWork } from "../../src/lib/playwright/save";


const URL =
  "https://video.dmm.co.jp/av/content/?id=dvmm00247&i3_ref=list&i3_ord=4&i3_pst=1&dmmref=video_list";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  let apiCount = 1;

page.on("response", async (response) => {
  try {
    const contentType = response.headers()["content-type"] ?? "";

    if (!contentType.includes("application/json")) {
      return;
    }

    const body = await response.text();

    const filePath = path.join(
      "tools",
      "fanza-inspector",
      "output",
      "api",
      `api-${apiCount}.json`
    );

    await fs.writeFile(filePath, body);

    console.log(`API保存: api-${apiCount}.json`);
    console.log(response.url());

    apiCount++;
  } catch (error) {
    console.error("API保存エラー:", error);
  }
});

  console.log("Opening...");

  await page.goto(URL, {
  waitUntil: "networkidle",
});

await page.waitForTimeout(5000);

// 年齢認証が表示されたら「はい」を押す
try {
  // 年齢認証が表示されたら「はい」を押す
try {
  await page.locator('text=はい').first().click();

  await page.waitForLoadState("networkidle");

  console.log("年齢認証を突破しました");
} catch {
  console.log("年齢認証は表示されませんでした");
}

  await page.waitForLoadState("networkidle");

  console.log("年齢認証を突破しました");
} catch {
  console.log("年齢認証は表示されませんでした");
}

console.log(await page.title());

const data = await parsePage(page);

console.log(data);

const PRODUCT_ID = "mide00890";

await saveWork(PRODUCT_ID, data);

console.log("保存完了");

const body = await page.locator("body").textContent();

await fs.writeFile(
  "tools/fanza-inspector/output/body.txt",
  body ?? ""
);

console.log("body保存");

const bodyHtml = await page.locator("body").innerHTML();

await fs.writeFile(
  "tools/fanza-inspector/output/body.html",
  bodyHtml
);

console.log("body.html保存");

const html = await page.content();

await fs.mkdir(
  "tools/fanza-inspector/output/html",
  {
    recursive: true,
  }
);

await fs.writeFile(
  "tools/fanza-inspector/output/html/page.html",
  html
);

console.log("HTMLを保存しました");

console.log("HTML Length:", html.length);

  await page.screenshot({
    path: "tools/fanza-inspector/output/page.png",
    fullPage: true,
  });

  await browser.close();
}

main();
