import { NextRequest, NextResponse } from "next/server";

import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildLocalPlaywrightUpdateOptions,
  localPlaywrightUpdateFailureMessage,
  localPlaywrightUpdateStatusMessage,
  selectLocalPlaywrightUpdateWorks,
  summarizeLocalPlaywrightUpdate,
  type LocalPlaywrightUpdateResult,
} from "@/lib/localPlaywrightUpdatePlan";

export const runtime = "nodejs";
export const maxDuration = 300;

function isLocalRequest(request: NextRequest): boolean {
  return ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname);
}

export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as { productId?: string; limit?: number; excludeProductIds?: string[] };
  const options = buildLocalPlaywrightUpdateOptions(body);

  let query = supabaseAdmin
    .from("works")
    .select("product_id,url,list_price")
    .not("url", "is", null);

  query = options.productId
    ? query.eq("product_id", options.productId)
    : query.eq("stage", "OLD").order("updated_at", { ascending: true });

  const { data: candidateWorks, error } = await query.limit(options.fetchLimit);
  const works = selectLocalPlaywrightUpdateWorks(candidateWorks, options);

  if (error) {
    console.error("[local-playwright-update] target lookup failed", error);
    return NextResponse.json(
      { success: false, message: "更新対象の取得に失敗しました。" },
      { status: 500 },
    );
  }

  if (!works?.length) {
    return NextResponse.json(
      { success: false, message: "更新対象が見つかりません。" },
      { status: 404 },
    );
  }

  let browser: Awaited<ReturnType<typeof createBrowser>> | null = null;
  const results: LocalPlaywrightUpdateResult[] = [];

  try {
    browser = await createBrowser();
    const activeBrowser = browser;

    // Local Chrome previously processed five pages concurrently. Keeping that
    // established batch size restores throughput without exposing Vercel's
    // serverless runtime to the same memory pressure.
    const parallel = 5;
    for (let offset = 0; offset < works.length; offset += parallel) {
      const batch = works.slice(offset, offset + parallel);
      const batchResults = await Promise.all(
        batch.map(async (work, batchIndex) => {
          console.log(
            `[local-playwright-update] ${offset + batchIndex + 1}/${works.length} ${work.product_id}`,
          );

          try {
            const status = await updatePlaywrightItem(
              work.product_id,
              work.url,
              activeBrowser,
              work.list_price,
            );
            return {
              productId: work.product_id,
              success: true,
              status,
              message: localPlaywrightUpdateStatusMessage(status),
            } as const;
          } catch (updateError) {
            const message = localPlaywrightUpdateFailureMessage(updateError);
            console.error(
              `[local-playwright-update] ${work.product_id} failed`,
              updateError,
            );
            return {
              productId: work.product_id,
              success: false,
              status: "failed",
              message,
            } as const;
          }
        }),
      );
      results.push(...batchResults);
    }

    return NextResponse.json(summarizeLocalPlaywrightUpdate(results));
  } catch (updateError) {
    console.error("[local-playwright-update] update failed", updateError);
    return NextResponse.json(
      {
        success: false,
        message: localPlaywrightUpdateFailureMessage(updateError),
      },
      { status: 500 },
    );
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
