import { existsSync } from "node:fs";
import { chromium, type Browser } from "playwright-core";

type BrowserOptions = {
  headless?: boolean;
};

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

function findLocalBrowserExecutable(): string {
  const configuredPath = process.env.PLAYWRIGHT_EXECUTABLE_PATH?.trim();
  const candidates = [
    configuredPath,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter((path): path is string => Boolean(path));

  const executablePath = candidates.find((path) => existsSync(path));
  if (!executablePath) {
    throw new Error(
      "Chrome または Edge が見つかりません。PLAYWRIGHT_EXECUTABLE_PATH にブラウザの実行ファイルを設定してください。"
    );
  }

  return executablePath;
}

export async function createBrowser(
  options: BrowserOptions = {}
): Promise<Browser> {
  if (isServerlessRuntime()) {
    const { default: serverlessChromium } =
      await import("@sparticuz/chromium");
    const executablePath =
      await serverlessChromium.executablePath();

    console.log("[browser] launching serverless Chromium", {
      runtime: process.env.VERCEL ? "vercel" : "lambda",
      executableAvailable: Boolean(executablePath),
    });

    try {
      const browser = await chromium.launch({
        headless: true,
        executablePath,
        args: [
          ...serverlessChromium.args,
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      browser.on("disconnected", () => {
        console.error("[browser] serverless Chromium disconnected");
      });

      return browser;
    } catch (error) {
      console.error("[browser] serverless Chromium launch failed", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  const executablePath = findLocalBrowserExecutable();
  console.log("[browser] launching local browser", { executablePath });

  return chromium.launch({
    headless: options.headless ?? true,
    executablePath,
    args: [
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
    ],
  });
}

export async function closeBrowser(
  browser: Browser
): Promise<void> {
  if (!browser.isConnected()) return;

  try {
    await browser.close();
  } catch (error) {
    console.warn("[browser] close failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
