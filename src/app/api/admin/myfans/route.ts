import { NextResponse } from "next/server";
import { importAffiliateText, importProducts, saveCreator, saveMedia, saveProduct, updateAffiliateLink } from "@/lib/myfansAdminCatalogActions";
import { importRevenue, saveClick, saveXAccountMetric } from "@/lib/myfansAdminMetricsActions";
import { savePost, selectDailyPlanCandidate, skipPermanentCandidate, updatePostExecution, updateQuoteCandidate } from "@/lib/myfansAdminPostActions";
import { text } from "@/lib/myfansAdminShared";

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
    const message = error instanceof Error ? error.message : "";
    const errorRecord = typeof error === "object" && error !== null ? error as { code?: unknown } : undefined;
    const errorCode = typeof errorRecord?.code === "string" && /^[0-9A-Z]{5}$/.test(errorRecord.code)
      ? errorRecord.code
      : undefined;
    console.error("myfans admin action failed", {
      action: /^[a-z_]{1,64}$/.test(action) ? action : "unknown",
      errorCode,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    const safeMessage = /^(投稿本文を入力してください|正規myfansアフィリンク|期限日時|商品が見つかりません|投稿IDがありません|未対応の更新|投稿URLを入力|対象日が不正|投稿枠が不正|候補はA\/B\/C|今日のDaily Planが見つかりません|selectedは)/.test(message)
      ? message
      : "myfans操作に失敗しました。入力を確認して、時間をおいて再試行してください。";
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 },
    );
  }
}
