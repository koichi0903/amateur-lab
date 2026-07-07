import { chromium } from "playwright";
import path from "path";
import fs from "fs/promises";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  await page.goto("https://www.dmm.co.jp/age_check/");

  console.log("");
  console.log("========================================");
  console.log("ブラウザで年齢認証を完了してください。");
  console.log("認証後、FANZAトップページが表示されたら Enter を押してください。");
  console.log("========================================");
  console.log("");

  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });

  const authDir = path.join(process.cwd(), "playwright", ".auth");

  await fs.mkdir(authDir, {
    recursive: true,
  });

  await context.storageState({
    path: path.join(authDir, "state.json"),
  });

  console.log("");
  console.log("✅ storageState 保存完了");
  console.log("");

  await browser.close();
}

main();