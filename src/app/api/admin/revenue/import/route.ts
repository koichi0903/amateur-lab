import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { decodeFanzaReportCsv, parseFanzaReportCsv } from "@/lib/fanzaReportCsv";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const LOOKUP_CHUNK_SIZE = 500;
const UPSERT_CHUNK_SIZE = 500;

function normalizeProductId(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

function stableRowKey(reportMonth: string, affiliateScope: string, productId: string, title: string) {
  return createHash("sha256")
    .update(`${reportMonth}|${affiliateScope}|${productId || title.normalize("NFKC").trim()}`)
    .digest("hex");
}

type ParsedReportRows = ReturnType<typeof parseFanzaReportCsv>;
type AggregatedReportRows = Map<string, ParsedReportRows[number]>;

function validateImportForm(formData: FormData) {
  const file = formData.get("file");
  const monthValue = String(formData.get("reportMonth") ?? "");
  const affiliateScope = String(formData.get("affiliateScope") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, response: NextResponse.json({ error: "CSVファイルを選択してください。" }, { status: 400 }) };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false as const, response: NextResponse.json({ error: "CSVは10MB以内にしてください。" }, { status: 400 }) };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue)) {
    return { ok: false as const, response: NextResponse.json({ error: "対象月を選択してください。" }, { status: 400 }) };
  }
  if (!["990", "026", "account-wide"].includes(affiliateScope)) {
    return { ok: false as const, response: NextResponse.json({ error: "レポートのアフィリエイトIDを選択してください。" }, { status: 400 }) };
  }

  return { ok: true as const, file, reportMonth: `${monthValue}-01`, affiliateScope };
}

function aggregateReportRows(parsedRows: ParsedReportRows): AggregatedReportRows {
  const aggregated: AggregatedReportRows = new Map();
  for (const row of parsedRows) {
    const productId = normalizeProductId(row.productId);
    const key = productId || row.title.normalize("NFKC").trim();
    const current = aggregated.get(key);
    if (current) {
      current.salesCount += row.salesCount;
      current.salesAmount += row.salesAmount;
      current.commissionAmount += row.commissionAmount;
    } else {
      aggregated.set(key, { ...row, productId });
    }
  }
  return aggregated;
}

function collectProductIds(aggregated: AggregatedReportRows) {
  return [...new Set([...aggregated.values()].map((row) => row.productId).filter(Boolean))];
}

async function getWorkIdsByProductId(productIds: string[]) {
  const workIdByProductId = new Map<string, number>();
  for (let index = 0; index < productIds.length; index += LOOKUP_CHUNK_SIZE) {
    const ids = productIds.slice(index, index + LOOKUP_CHUNK_SIZE);
    const { data, error } = await supabaseAdmin
      .from("works")
      .select("id,product_id")
      .in("product_id", ids);
    if (error) throw error;
    for (const work of data ?? []) {
      if (work.product_id) workIdByProductId.set(normalizeProductId(work.product_id), work.id);
    }
  }
  return workIdByProductId;
}

function buildImportRecords(aggregated: AggregatedReportRows, workIdByProductId: Map<string, number>, reportMonth: string, affiliateScope: string, fileName: string, now: string) {
  return [...aggregated.values()].map((row) => ({
    report_month: reportMonth,
    work_id: row.productId ? (workIdByProductId.get(row.productId) ?? null) : null,
    product_id: row.productId,
    title: row.title,
    sales_count: row.salesCount,
    sales_amount: row.salesAmount,
    commission_amount: row.commissionAmount,
    source_file: `scope:${affiliateScope}|${fileName}`.slice(0, 255),
    row_key: stableRowKey(reportMonth, affiliateScope, row.productId, row.title),
    imported_at: now,
  }));
}

async function upsertImportRecords(records: ReturnType<typeof buildImportRecords>) {
  for (let index = 0; index < records.length; index += UPSERT_CHUNK_SIZE) {
    const { error } = await supabaseAdmin
      .from("affiliate_sales")
      .upsert(records.slice(index, index + UPSERT_CHUNK_SIZE), { onConflict: "row_key" });
    if (error) {
      if (error.message.includes("affiliate_sales")) {
        throw new Error("売上テーブルがありません。先に20260817_add_affiliate_sales.sqlを実行してください。");
      }
      throw error;
    }
  }
}

function buildImportResponse(records: ReturnType<typeof buildImportRecords>, affiliateScope: string) {
  const matched = records.filter((row) => row.work_id !== null).length;
  return NextResponse.json({
    imported: records.length,
    matched,
    unmatched: records.length - matched,
    totalCommission: records.reduce((sum, row) => sum + row.commission_amount, 0),
    scopeLabel: affiliateScope === "990" ? "ID990" : affiliateScope === "026" ? "ID026" : "全体・ID不明",
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const upload = validateImportForm(formData);
    if (!upload.ok) return upload.response;

    const parsedRows = parseFanzaReportCsv(decodeFanzaReportCsv(await upload.file.arrayBuffer()));
    if (!parsedRows.length) {
      return NextResponse.json({ error: "取込可能な明細がありません。" }, { status: 400 });
    }

    const aggregated = aggregateReportRows(parsedRows);
    const productIds = collectProductIds(aggregated);
    const workIdByProductId = await getWorkIdsByProductId(productIds);
    const records = buildImportRecords(aggregated, workIdByProductId, upload.reportMonth, upload.affiliateScope, upload.file.name, new Date().toISOString());
    await upsertImportRecords(records);
    return buildImportResponse(records, upload.affiliateScope);
  } catch (error) {
    console.error("FANZA report import failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CSVの取込に失敗しました。" },
      { status: 500 },
    );
  }
}
