import { saveMyfansAffiliateTextImport } from "../myfansAffiliateTextImport";
import { MYFANS_AFFILIATE_URL_SOURCE_MANUAL, normalizeMyfansAffiliateUrl } from "../myfansAffiliateLink";
import { audit, MAX_FILE_SIZE, nullableId, text } from "./myfansAdminShared";
import { supabaseAdmin } from "../supabaseAdmin";
import { buildMyfansProductImportRecord } from "./myfansProductCsvImport";
import { buildMyfansProductFormRecord } from "./myfansProductFormRecord";

export async function saveCreator(formData: FormData) {
  const id = nullableId(formData, "id");
  const record = {
    display_name: text(formData, "display_name"),
    myfans_url: text(formData, "myfans_url"),
    x_url: text(formData, "x_url"),
    creator_x_url: text(formData, "creator_x_url") || text(formData, "x_url"),
    source_x_handle: text(formData, "source_x_handle"),
    latest_quote_x_url: text(formData, "latest_quote_x_url"),
    genre: text(formData, "genre"),
    activity_note: text(formData, "activity_note"),
    is_active: text(formData, "is_active") !== "false",
    updated_at: new Date().toISOString(),
  };
  if (!record.display_name) throw new Error("クリエイター名を入力してください。");

  const query = id
    ? supabaseAdmin.from("myfans_creators").update(record).eq("id", id).select("id").single()
    : supabaseAdmin.from("myfans_creators").insert(record).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  await audit("creator", data.id, id ? "update" : "create", record.display_name);
  return { id: data.id };
}

export async function saveMedia(formData: FormData) {
  const id = nullableId(formData, "id");
  const record = {
    media_name: text(formData, "media_name"),
    media_url: text(formData, "media_url"),
    affiliate_media_id: text(formData, "affiliate_media_id"),
    status: text(formData, "status") || "active",
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };
  if (!record.media_name) throw new Error("メディア名を入力してください。");

  const query = id
    ? supabaseAdmin.from("myfans_approved_media").update(record).eq("id", id).select("id").single()
    : supabaseAdmin.from("myfans_approved_media").insert(record).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  await audit("media", data.id, id ? "update" : "create", record.media_name);
  return { id: data.id };
}

export async function saveProduct(formData: FormData) {
  const id = nullableId(formData, "id");
  const approvedMediaName = text(formData, "approved_media_name");
  let approvedMediaId = nullableId(formData, "approved_media_id");
  if (!approvedMediaId && approvedMediaName) {
    const { data: media } = await supabaseAdmin
      .from("myfans_approved_media")
      .select("id")
      .eq("media_name", approvedMediaName)
      .maybeSingle();
    approvedMediaId = media?.id ?? null;
  }
  const { record, selectionScore } = buildMyfansProductFormRecord(formData, approvedMediaId);
  if (!record.title) throw new Error("商品名を入力してください。");

  const query = id
    ? supabaseAdmin.from("myfans_products").update(record).eq("id", id).select("id").single()
    : supabaseAdmin.from("myfans_products").insert(record).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  await audit("product", data.id, id ? "update" : "create", record.title, { selectionScore });
  return { id: data.id, selectionScore };
}

function parseBulkProducts(textValue: string) {
  const lines = textValue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (!headerLine || !rows.length) return [];
  const headers = headerLine.split(",").map((header) => header.normalize("NFKC").trim());
  return rows.map((line) => {
    const cells = line.split(",").map((cell) => cell.normalize("NFKC").trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

export async function importProducts(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("CSVファイルを選択してください。");
  if (file.size > MAX_FILE_SIZE) throw new Error("CSVは10MB以内にしてください。");

  const rows = parseBulkProducts(new TextDecoder("utf-8").decode(await file.arrayBuffer()));
  if (!rows.length) throw new Error("登録できる商品行がありません。");

  const records = rows.map((row) => buildMyfansProductImportRecord(row)).filter((row) => row.title);

  if (!records.length) throw new Error("商品名が入った行がありません。");
  const { error } = await supabaseAdmin
    .from("myfans_products")
    .upsert(records, { onConflict: "product_url", ignoreDuplicates: false });
  if (error) throw error;
  await audit("import", null, "product_csv_import", file.name, { rows: records.length });
  return { imported: records.length };
}

export async function importAffiliateText(formData: FormData) {
  const affiliateText = text(formData, "affiliate_text");
  if (!affiliateText) throw new Error("myfans管理画面からコピーしたテキストを貼り付けてください。");
  return saveMyfansAffiliateTextImport(affiliateText);
}

export async function updateAffiliateLink(formData: FormData) {
  const productId = nullableId(formData, "product_id");
  if (!productId) throw new Error("商品IDがありません。");
  const affiliateUrl = normalizeMyfansAffiliateUrl(text(formData, "affiliate_url"));
  if (!affiliateUrl) throw new Error("正規のmyfansアフィリンク（https://mfco.link/r/...）だけ保存できます。");
  const expiresAt = text(formData, "affiliate_url_expires_at");
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) throw new Error("期限日時の形式を確認してください。");

  const { data: product, error: productError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,title")
    .eq("id", productId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("商品が見つかりません。");

  const generatedAt = text(formData, "affiliate_url_generated_at") || new Date().toISOString();
  const record = {
    affiliate_url: affiliateUrl,
    affiliate_url_generated_at: generatedAt,
    affiliate_url_expires_at: expiresAt || null,
    affiliate_url_source: text(formData, "affiliate_url_source") || MYFANS_AFFILIATE_URL_SOURCE_MANUAL,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from("myfans_products").update(record).eq("id", productId);
  if (error) throw error;
  await audit("product", productId, "affiliate_link_update", product.title, record);
  return { id: productId, affiliateUrl };
}
