import { NextResponse } from "next/server";
import { importAffiliateText, importProducts, saveCreator, saveMedia, saveProduct, updateAffiliateLink } from "@/lib/myfans/myfansAdminCatalogActions";
import { importRevenue, saveClick, saveXAccountMetric } from "@/lib/myfans/myfansAdminMetricsActions";
import { savePost, selectDailyPlanCandidate, skipPermanentCandidate, updatePostExecution, updateQuoteCandidate } from "@/lib/myfans/myfansAdminPostActions";
import { text } from "@/lib/myfans/myfansAdminShared";
import { buildMyfansAdminErrorContext, getSafeMyfansAdminErrorMessage } from "@/lib/myfans/myfansAdminErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionHandlers = {
  creator: saveCreator,
  media: saveMedia,
  product: saveProduct,
  product_import: importProducts,
  affiliate_text_import: importAffiliateText,
  affiliate_link_update: updateAffiliateLink,
  post: savePost,
  daily_plan_select: selectDailyPlanCandidate,
  post_execution_update: updatePostExecution,
  permanent_candidate_skip: skipPermanentCandidate,
  quote_candidate_update: updateQuoteCandidate,
  click: saveClick,
  x_account_metric: saveXAccountMetric,
  revenue_import: importRevenue,
} as const;

export async function POST(request: Request) {
  let action = "unknown";
  try {
    const formData = await request.formData();
    action = text(formData, "action") || "unknown";
    const result = await actionHandlers[action as keyof typeof actionHandlers]?.(formData) ?? null;

    if (!result) return NextResponse.json({ error: "未対応の操作です。" }, { status: 400 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("myfans admin action failed", buildMyfansAdminErrorContext(action, error));
    return NextResponse.json(
      { error: getSafeMyfansAdminErrorMessage(error) },
      { status: 500 },
    );
  }
}
