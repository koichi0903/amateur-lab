import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { getAmateurProducts } from "@/lib/playwright/getAmateurProducts";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaPage } from "@/lib/playwright/fanzaAgeGate";
import { parsePage } from "@/lib/playwright/parser";

type DmmApiProbeResult = {
  floor: string;
  found: boolean;
  title?: string;
  url?: string;
  error?: string;
};

const DMM_FLOOR_CANDIDATES = ["videoa", "videoc", "amateur"];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    limit: Number(
      process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ??
        10,
    ),
    detailLimit: Number(
      process.argv
        .find((arg) => arg.startsWith("--detail-limit="))
        ?.split("=")[1] ?? 3,
    ),
    headed: args.has("--headed"),
  };
}

async function probeDmmApi(productId: string): Promise<DmmApiProbeResult[]> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    return DMM_FLOOR_CANDIDATES.map((floor) => ({
      floor,
      found: false,
      error: "DMM API credentials are not configured",
    }));
  }

  return Promise.all(
    DMM_FLOOR_CANDIDATES.map(async (floor) => {
      const url =
        "https://api.dmm.com/affiliate/v3/ItemList" +
        `?api_id=${encodeURIComponent(apiId)}` +
        `&affiliate_id=${encodeURIComponent(affiliateId)}` +
        "&site=FANZA" +
        "&service=digital" +
        `&floor=${encodeURIComponent(floor)}` +
        `&cid=${encodeURIComponent(productId)}` +
        "&output=json";

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          return { floor, found: false, error: `HTTP ${response.status}` };
        }

        const json = await response.json();
        const item = json?.result?.items?.[0];
        return {
          floor,
          found: Boolean(item),
          title: item?.title,
          url: item?.URL,
        };
      } catch (error) {
        return {
          floor,
          found: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

async function probeDetails(
  products: Awaited<ReturnType<typeof getAmateurProducts>>,
  detailLimit: number,
  headed: boolean,
) {
  const browser = await createBrowser({ headless: !headed });

  try {
    const results = [];

    for (const product of products.slice(0, detailLimit)) {
      const page = await browser.newPage();

      try {
        await openFanzaPage(page, product.url);
        await page.waitForTimeout(5_000);
        const parsed = await parsePage(page);

        results.push({
          productId: product.productId,
          url: product.url,
          finalUrl: page.url(),
          parsed: {
            hasTitle: Boolean(parsed.title),
            priceCount: parsed.prices.length,
            hasImage: Boolean(parsed.ogImage),
            hasMaker: Boolean(parsed.maker),
            hasReleaseDate: Boolean(parsed.releaseDate),
            saleEndAt: parsed.saleEndAt?.toISOString() ?? null,
          },
        });
      } catch (error) {
        const diagnostics = await page
          .evaluate(() => ({
            url: window.location.href,
            title: document.title,
            labelCount: document.querySelectorAll("label").length,
            contentPriceCount: document.querySelectorAll(
              '[data-e2eid="content-price"]',
            ).length,
            bodyText: document.body?.innerText
              ?.replace(/\s+/g, " ")
              .trim()
              .slice(0, 400),
          }))
          .catch((diagnosticError) => ({
            diagnosticError:
              diagnosticError instanceof Error
                ? diagnosticError.message
                : String(diagnosticError),
          }));

        results.push({
          productId: product.productId,
          url: product.url,
          error: error instanceof Error ? error.message : String(error),
          diagnostics,
        });
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    return results;
  } finally {
    await closeBrowser(browser);
  }
}

async function main() {
  const { limit, detailLimit, headed } = parseArgs();

  console.log(`[amateur-probe] list start limit=${limit}`);
  const products = await getAmateurProducts(limit);
  console.log("[amateur-probe] list result");
  console.table(products);

  const apiProducts = products.slice(0, Math.min(products.length, 3));
  for (const product of apiProducts) {
    const apiResults = await probeDmmApi(product.productId);
    console.log(`[amateur-probe] DMM API ${product.productId}`);
    console.table(apiResults);
  }

  console.log(
    `[amateur-probe] detail start limit=${Math.min(detailLimit, products.length)}`,
  );
  const detailResults = await probeDetails(products, detailLimit, headed);
  console.dir(detailResults, { depth: null });
}

main().catch((error) => {
  console.error("[amateur-probe] failed", error);
  process.exitCode = 1;
});

