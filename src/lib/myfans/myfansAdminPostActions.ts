import { audit, nullableId, rowKey, text } from "./myfansAdminShared";
import {
  readMyfansDailyPlanSelectionInput,
  requireMyfansDailyPlanSelectionPlan,
  selectDailyPlanOption,
} from "./myfansDailyPlanSelection";
import { exclusionTargetForCandidate, manualCandidateExclusionTarget, recordMyfansPermanentExclusion } from "../myfansPermanentExclusions";
import { supabaseAdmin } from "../supabaseAdmin";
import { buildMyfansPatternLearningValues, buildMyfansPostExecutionRecord, type MyfansAttributedPostMetrics, type MyfansPatternLearningRow, type MyfansPostExecutionRecord } from "./myfansPostExecutionData";
import { buildMyfansPostRecord, type MyfansPostRecordContext } from "./myfansAdminPostData";

async function resolvePostRecordContext(formData: FormData, productId: number | null): Promise<MyfansPostRecordContext> {
  let approvedMediaId = nullableId(formData, "approved_media_id");
  let approvedMediaName = text(formData, "approved_media_name");
  if (productId && !approvedMediaId) {
    const { data: product } = await supabaseAdmin
      .from("myfans_products")
      .select("approved_media_id,approved_media_name")
      .eq("id", productId)
      .maybeSingle();
    approvedMediaId = product?.approved_media_id ?? null;
    approvedMediaName = approvedMediaName || product?.approved_media_name || "";
  }

  let patternId = nullableId(formData, "pattern_id");
  const patternKey = text(formData, "market_pattern_key");
  if (!patternId && patternKey) {
    const { data: pattern, error: patternError } = await supabaseAdmin
      .from("myfans_market_patterns")
      .select("id")
      .eq("pattern_key", patternKey)
      .maybeSingle();
    if (patternError && !/market_patterns|schema cache|column/i.test(patternError.message)) throw patternError;
    patternId = pattern?.id ?? null;
  }
  return { productId, approvedMediaId, approvedMediaName, patternId };
}

function myfansPostIdempotencyKey(formData: FormData, id: number | null, approvedMediaId: number | null, record: ReturnType<typeof buildMyfansPostRecord>) {
  const suppliedKey = text(formData, "idempotency_key");
  if (suppliedKey) return suppliedKey;
  if (id) return `post:${id}`;
  const contentKey = record.creative_variant_id
    ? `variant:${record.creative_variant_id}`
    : rowKey(record.body, record.quote_x_url, record.planned_slot);
  return `${approvedMediaId ?? "shared"}:${contentKey}`;
}

async function persistMyfansPostRecord(id: number | null, idempotencyKey: string, record: ReturnType<typeof buildMyfansPostRecord>) {
  const { data, error } = await supabaseAdmin.rpc("save_myfans_post", {
    p_post: { ...record, id: id ?? null, idempotency_key: idempotencyKey },
    p_idempotency_key: idempotencyKey,
    p_quote_x_url: record.creative_strategy === "quote_post" ? record.quote_x_url : "",
  });
  if (error || !data?.post_id) {
    console.error("myfans post save RPC failed", error?.message ?? "invalid response");
    throw new Error("投稿ログの保存に失敗しました。入力を確認して、時間をおいて再試行してください。");
  }
  const { error: attributionError } = await supabaseAdmin.from("myfans_x_posts").update({
    pattern_id: record.pattern_id,
    quote_candidate_id: record.quote_candidate_id,
    creator_id: record.creator_id,
    strategy_type: record.strategy_type,
    global_content_fingerprint: record.global_content_fingerprint,
  }).eq("id", Number(data.post_id));
  if (attributionError && !/pattern_id|quote_candidate_id|creator_id|strategy_type|global_content_fingerprint|schema cache|column/i.test(attributionError.message)) throw attributionError;
  return Number(data.post_id);
}

export async function savePost(formData: FormData) {
  const id = nullableId(formData, "id");
  const productId = nullableId(formData, "product_id");
  const context = await resolvePostRecordContext(formData, productId);
  const record = buildMyfansPostRecord(formData, context);
  if (!record.body) throw new Error("投稿本文を入力してください。");
  const idempotencyKey = myfansPostIdempotencyKey(formData, id, context.approvedMediaId, record);
  const postId = await persistMyfansPostRecord(id, idempotencyKey, record);
  await audit("x_post", postId, id ? "update" : "create", record.body.slice(0, 80));
  return { id: postId };
}

export async function selectDailyPlanCandidate(formData: FormData) {
  const { approvedMediaId, planDate, postOrder, optionLabel } = readMyfansDailyPlanSelectionInput(formData);

  const planQuery = supabaseAdmin
    .from("myfans_daily_plans")
    .select("id,strategy_json")
    .eq("plan_date", planDate);
  const scopedPlanQuery = approvedMediaId ? planQuery.eq("approved_media_id", approvedMediaId) : planQuery.is("approved_media_id", null);
  const { data: planData, error: planError } = await scopedPlanQuery.maybeSingle();
  const plan = requireMyfansDailyPlanSelectionPlan(planData, planError);

  const strategyJson = plan.strategy_json && typeof plan.strategy_json === "object" ? plan.strategy_json as Record<string, unknown> : {};
  const nextStrategyJson = selectDailyPlanOption(strategyJson, postOrder, optionLabel);
  const { error: planUpdateError } = await supabaseAdmin
    .from("myfans_daily_plans")
    .update({
      strategy_json: nextStrategyJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);
  if (planUpdateError) throw planUpdateError;

  const { error: clearError } = await supabaseAdmin
    .from("myfans_daily_plan_posts")
    .update({ is_selected: false, selected_at: null })
    .eq("daily_plan_id", plan.id)
    .eq("post_order", postOrder);
  if (clearError && !/is_selected|selected_at|schema cache|column/i.test(clearError.message)) throw clearError;

  const { data: selected, error: selectError } = await supabaseAdmin
    .from("myfans_daily_plan_posts")
    .update({ is_selected: true, selected_at: new Date().toISOString() })
    .eq("daily_plan_id", plan.id)
    .eq("post_order", postOrder)
    .eq("option_label", optionLabel)
    .select("id")
    .maybeSingle();
  if (selectError && !/is_selected|selected_at|option_label|schema cache|column/i.test(selectError.message)) throw selectError;
  await audit("daily_plan", plan.id, "select_candidate", `slot ${postOrder} option ${optionLabel}`);
  return { id: selected?.id ?? plan.id };
}

async function updatePatternLearningForPost(id: number, post: MyfansAttributedPostMetrics) {
  const scope = supabaseAdmin
    .from("myfans_pattern_learning")
    .select("id,impressions,engagements,clicks,posts_count,posterior_weight")
    .eq("approved_media_id", post.approved_media_id)
    .eq("pattern_id", post.pattern_id);
  const scopedCreator = post.creator_id ? scope.eq("creator_id", post.creator_id) : scope.is("creator_id", null);
  const scopedProduct = post.product_id ? scopedCreator.eq("product_id", post.product_id) : scopedCreator.is("product_id", null);
  const scopedQuote = post.quote_candidate_id ? scopedProduct.eq("quote_candidate_id", post.quote_candidate_id) : scopedProduct.is("quote_candidate_id", null);
  const { data: learning } = await scopedQuote.maybeSingle();
  const next = buildMyfansPatternLearningValues(post, learning as MyfansPatternLearningRow | null, id);
  const learningWrite = learning?.id
    ? await supabaseAdmin.from("myfans_pattern_learning").update(next).eq("id", learning.id)
    : await supabaseAdmin.from("myfans_pattern_learning").insert(next);
  if (learningWrite.error) throw learningWrite.error;
}

async function updateMetricsExecution(id: number, record: MyfansPostExecutionRecord) {
  const { error } = await supabaseAdmin.from("myfans_x_posts").update(record).eq("id", id);
  if (error) throw error;
  const { data: attributedPost, error: attributedPostError } = await supabaseAdmin
    .from("myfans_x_posts")
    .select("approved_media_id,pattern_id,creator_id,product_id,quote_candidate_id,impressions,likes_count,reposts_count,replies_count,clicks")
    .eq("id", id)
    .maybeSingle();
  if (attributedPostError && !/pattern_id|quote_candidate_id|creator_id|schema cache|column/i.test(attributedPostError.message)) throw attributedPostError;
  if (attributedPost?.approved_media_id && attributedPost.pattern_id) {
    await updatePatternLearningForPost(id, attributedPost as MyfansAttributedPostMetrics);
  }
}

async function finalizePostedExecution(id: number, mode: string, formData: FormData) {
  const postedAt = new Date().toISOString();
  const { data: post, error: postError } = await supabaseAdmin
    .from("myfans_x_posts")
    .select("id,product_id,quote_x_url,source_x_url,approved_media_id")
    .eq("id", id)
    .single();
  if (postError) throw postError;
  const finalized = await supabaseAdmin.rpc("save_myfans_post", {
    p_post: { id, status: "posted", posted_at: postedAt, approved_media_id: post.approved_media_id, x_post_url: mode === "url" ? text(formData, "x_post_url") : undefined },
    p_idempotency_key: `post:${id}`,
    p_quote_x_url: post.quote_x_url || post.source_x_url || "",
  });
  if (finalized.error || !finalized.data?.post_id) throw new Error("投稿完了処理に失敗しました。再度状態を確認してください。");

  const sourceUrl = post.quote_x_url || post.source_x_url || "";
  const target = exclusionTargetForCandidate({ productId: null, quoteXUrl: sourceUrl, sourceXUrl: sourceUrl });
  if (!target) return;
  const exclusion = await recordMyfansPermanentExclusion({
    ...target,
    approvedMediaId: post.approved_media_id,
    reason: "posted",
    context: { recorded_from: "myfans_post_execution", post_id: id },
  });
  if (exclusion.error) throw exclusion.error;
}

export async function updatePostExecution(formData: FormData) {
  const id = nullableId(formData, "id");
  if (!id) throw new Error("投稿IDがありません。");
  const mode = text(formData, "mode");
  const record = buildMyfansPostExecutionRecord(mode, formData);
  if (!record) throw new Error("未対応の更新です。");
  if (mode === "url" && !text(formData, "x_post_url")) throw new Error("投稿URLを入力してください。");
  if (mode === "metrics") {
    await updateMetricsExecution(id, record);
  } else {
    await finalizePostedExecution(id, mode, formData);
  }
  await audit("x_post", id, `execution_${mode}`, "投稿実行ボードから更新", record);
  return { id };
}

export async function skipPermanentCandidate(formData: FormData) {
  const quoteXUrl = text(formData, "quote_x_url");
  const sourceXUrl = text(formData, "source_x_url");
  const quoteCandidateId = nullableId(formData, "quote_candidate_id");
  const target = manualCandidateExclusionTarget({ quoteXUrl, sourceXUrl, quoteCandidateId });
  if (!target) throw new Error("恒久除外する候補のsourceを特定できません。");
  const { error } = await recordMyfansPermanentExclusion({
    ...target,
    approvedMediaId: nullableId(formData, "approved_media_id"),
    reason: "user_skipped",
    context: { recorded_from: "myfans_3x4_skip", plan_date: text(formData, "plan_date") || null, candidate_id: text(formData, "candidate_id") || null },
  });
  if (error) throw error;
  await audit(target.entityType, target.productId, "permanent_candidate_skipped", target.entityKey, { sourceStatusUrl: target.sourceStatusUrl, quoteCandidateId });
  return { entityKey: target.entityKey };
}

export async function updateQuoteCandidate(formData: FormData) {
  const productId = nullableId(formData, "product_id");
  const quoteUrl = text(formData, "quote_candidate_x_url");
  if (!productId) throw new Error("商品IDがありません。");
  if (!/^https:\/\/(x\.com|twitter\.com)\/[^/\s]+\/status\/\d+/.test(quoteUrl)) {
    throw new Error("creator本人のX投稿URLを入力してください。");
  }
  const { data: product, error: productError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,title,creator_x_url")
    .eq("id", productId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("商品が見つかりません。");
  if (product.creator_x_url) {
    const creatorHandle = String(product.creator_x_url).match(/(?:x\.com|twitter\.com)\/([^/?#]+)/)?.[1]?.toLowerCase();
    const quoteHandle = quoteUrl.match(/(?:x\.com|twitter\.com)\/([^/?#]+)/)?.[1]?.toLowerCase();
    if (creatorHandle && quoteHandle && creatorHandle !== quoteHandle) {
      throw new Error("creator本人のX投稿URLだけ登録できます。");
    }
  }
  const { error } = await supabaseAdmin
    .from("myfans_products")
    .update({ quote_candidate_x_url: quoteUrl, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
  await audit("product", productId, "quote_candidate_update", product.title, { quoteUrl });
  return { id: productId };
}
