import { NextRequest, NextResponse } from "next/server";

import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

function isLocalRequest(request: NextRequest): boolean {
  return ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname);
}

export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    productId?: string;
    limit?: number;
    excludeProductIds?: string[];
  };
  const requestedProductId = body.productId?.trim();
  const requestedLimit = Number.isFinite(body.limit)
    ? Math.trunc(body.limit ?? 10)
    : 10;
  const limit = requestedProductId
    ? 1
    : Math.min(Math.max(requestedLimit, 1), 100);
  const excludeProductIds = (body.excludeProductIds ?? [])
    .filter((id) => /^[a-zA-Z0-9_-]+$/.test(id))
    .slice(0, 100);

  let query = supabaseAdmin
    .from("works")
    .select("product_id,url,list_price,sample_movie_url")
    .not("url", "is", null);

  query = requestedProductId
    ? query.eq("product_id", requestedProductId)
    : query.eq("stage", "OLD").order("updated_at", { ascending: true });

  const fetchLimit = requestedProductId
    ? 1
    : Math.min(limit + excludeProductIds.length, 200);
  const { data: candidateWorks, error } = await query.limit(fetchLimit);
  const excluded = new Set(excludeProductIds);
  const works = (candidateWorks ?? [])
    .filter((work) => !excluded.has(work.product_id))
    .slice(0, limit);

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
  const results: Array<{
    productId: string;
    success: boolean;
    status: "updated" | "unavailable" | "failed";
    message?: string;
  }> = [];

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
              false,
              work.sample_movie_url,
            );
            return {
              productId: work.product_id,
              success: true,
              status,
              message:
                status === "unavailable"
                  ? "FANZA側でページまたは価格を確認できませんでした。"
                  : undefined,
            } as const;
          } catch (updateError) {
            const message =
              updateError instanceof Error
                ? updateError.message
                : "Playwright更新に失敗しました。";
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

    const succeeded = results.filter(
      (result) => result.status === "updated",
    ).length;
    const unavailable = results.filter(
      (result) => result.status === "unavailable",
    ).length;
    const failed = results.filter(
      (result) => result.status === "failed",
    ).length;

    return NextResponse.json({
      success: failed === 0,
      succeeded,
      unavailable,
      failed,
      results,
      message: `ローカルPlaywright更新: 更新${succeeded}件 / 利用不可${unavailable}件 / 失敗${failed}件`,
    });
  } catch (updateError) {
    console.error("[local-playwright-update] update failed", updateError);
    return NextResponse.json(
      {
        success: false,
        message:
          updateError instanceof Error
            ? updateError.message
            : "Playwright更新に失敗しました。",
      },
      { status: 500 },
    );
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
