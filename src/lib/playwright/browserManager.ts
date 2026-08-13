import { Browser, chromium } from "playwright";

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

    return chromium.launch({
      headless: true,
      executablePath:
        await serverlessChromium.executablePath(),
      args: [
        ...serverlessChromium.args,
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
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
