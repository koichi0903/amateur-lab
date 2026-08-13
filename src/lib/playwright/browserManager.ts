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
      return await chromium.launch({
        headless: true,
        executablePath,
        args: [
          ...serverlessChromium.args,
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
    } catch (error) {
      console.error("[browser] serverless Chromium launch failed", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  return chromium.launch({
    headless: options.headless ?? true,
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
  await browser.close();
}
