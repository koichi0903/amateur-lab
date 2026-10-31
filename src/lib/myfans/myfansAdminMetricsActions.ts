import { parseMyfansReportCsv } from "../myfansCsv";
import { audit, intValue, MAX_FILE_SIZE, nullableId, rowKey, text } from "./myfansAdminShared";
import { supabaseAdmin } from "../supabaseAdmin";

export async function saveClick(formData: FormData) {
  const record = {
    approved_media_id: nullableId(formData, "approved_media_id"),
    product_id: nullableId(formData, "product_id"),
    x_post_id: nullableId(formData, "x_post_id"),
    clicked_at: text(formData, "clicked_at") || new Date().toISOString(),
    source: text(formData, "source") || "x",
    placement: text(formData, "placement") || "self_reply",
    note: text(formData, "note"),
  };
  const { data, error } = await supabaseAdmin.from("myfans_affiliate_clicks").insert(record).select("id").single();
  if (error) throw error;
  await audit("click", data.id, "create", "クリック実績を追加", record);
  return { id: data.id };
}

export async function saveXAccountMetric(formData: FormData) {
  const approvedMediaId = nullableId(formData, "approved_media_id");
  const metricDate = text(formData, "metric_date");
  if (!approvedMediaId) throw new Error("承認済みメディアを選択してください。");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) throw new Error("週の終了日を選択してください。");

  const followingInput = text(formData, "following_count");
  const record = {
    metric_date: metricDate,
    approved_media_id: approvedMediaId,
    followers_count: intValue(formData, "followers_count"),
    following_count: followingInput ? intValue(formData, "following_count") : null,
    profile_visits: intValue(formData, "profile_visits"),
    total_impressions: intValue(formData, "total_impressions"),
    posts_count: intValue(formData, "posts_count"),
    likes: intValue(formData, "likes"),
    reposts: intValue(formData, "reposts"),
    replies: intValue(formData, "replies"),
    affiliate_clicks: intValue(formData, "affiliate_clicks"),
    conversions: intValue(formData, "conversions"),
    reward_amount: intValue(formData, "reward_amount"),
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("myfans_x_account_metrics")
    .upsert(record, { onConflict: "approved_media_id,metric_date", ignoreDuplicates: false })
    .select("id")
    .single();
  if (error) throw error;
  await audit("media", approvedMediaId, "x_account_weekly_metric_upsert", metricDate, record);
  return { id: data.id };
}

export async function importRevenue(formData: FormData) {
  const file = formData.get("file");
  const reportMonthInput = text(formData, "reportMonth");
  const approvedMediaId = nullableId(formData, "approved_media_id");
  if (!approvedMediaId) throw new Error("アカウントを選択してからCSVを取り込んでください。");
  if (!(file instanceof File) || file.size === 0) throw new Error("CSVファイルを選択してください。");
  if (file.size > MAX_FILE_SIZE) throw new Error("CSVは10MB以内にしてください。");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reportMonthInput)) throw new Error("対象月を選択してください。");

  const csv = new TextDecoder("utf-8").decode(await file.arrayBuffer());
  const rows = parseMyfansReportCsv(csv);
  if (!rows.length) throw new Error("取込可能な明細がありません。");

  const { data: products, error: productError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,product_url,title");
  if (productError) throw productError;
  const productByUrl = new Map((products ?? []).map((product) => [product.product_url, product.id]));
  const productByTitle = new Map((products ?? []).map((product) => [product.title, product.id]));
  const sourceFile = file.name.slice(0, 255);
  const records = rows.map((row) => ({
    approved_media_id: approvedMediaId,
    product_id: productByUrl.get(row.productUrl) ?? productByTitle.get(row.title) ?? null,
    conversion_type: row.conversionType,
    occurred_at: new Date(row.occurredAt).toISOString(),
    sale_amount: row.saleAmount,
    reward_amount: row.rewardAmount,
    reward_rate: row.rewardRate,
    source_file: sourceFile,
    row_key: rowKey(String(approvedMediaId), reportMonthInput, sourceFile, row.occurredAt, row.productUrl, row.title, String(row.rewardAmount)),
    note: "",
  }));

  const { error } = await supabaseAdmin
    .from("myfans_conversions")
    .upsert(records, { onConflict: "row_key", ignoreDuplicates: false });
  if (error) throw error;

  const totalSalesAmount = records.reduce((sum, row) => sum + row.sale_amount, 0);
  const totalRewardAmount = records.reduce((sum, row) => sum + row.reward_amount, 0);
  await supabaseAdmin.from("myfans_revenue_imports").upsert({
    report_month: `${reportMonthInput}-01`,
    source_file: sourceFile,
    rows_count: records.length,
    total_sales_amount: totalSalesAmount,
    total_reward_amount: totalRewardAmount,
    approved_media_id: approvedMediaId,
  }, { onConflict: "approved_media_id,report_month,source_file" });
  await audit("import", null, "csv_import", sourceFile, { rows: records.length, totalRewardAmount });

  return {
    imported: records.length,
    matched: records.filter((row) => row.product_id !== null).length,
    totalRewardAmount,
  };
}
