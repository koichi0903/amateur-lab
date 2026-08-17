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

function stableRowKey(reportMonth: string, productId: string, title: string) {
  return createHash("sha256")
    .update(`${reportMonth}|${productId || title.normalize("NFKC").trim()}`)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const monthValue = String(formData.get("reportMonth") ?? "");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "CSVファイルを選択してください。" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "CSVは10MB以内にしてください。" }, { status: 400 });
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue)) {
      return NextResponse.json({ error: "対象月を選択してください。" }, { status: 400 });
    }

    const reportMonth = `${monthValue}-01`;
    const parsedRows = parseFanzaReportCsv(
      decodeFanzaReportCsv(await file.arrayBuffer()),
    );
    if (!parsedRows.length) {
      return NextResponse.json({ error: "取込可能な明細がありません。" }, { status: 400 });
    }

    const aggregated = new Map<string, (typeof parsedRows)[number]>();
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

    const productIds = [...new Set(
      [...aggregated.values()].map((row) => row.productId).filter(Boolean),
    )];
    const workIdByProductId = new Map<string, number>();
    for (let index = 0; index < productIds.length; index += LOOKUP_CHUNK_SIZE) {
      const ids = productIds.slice(index, index + LOOKUP_CHUNK_SIZE);
      const { data, error } = await supabaseAdmin
        .from("works")
        .select("id,product_id")
        .in("product_id", ids);
      if (error) throw error;
      for (const work of data ?? []) {
        if (work.product_id) {
          workIdByProductId.set(normalizeProductId(work.product_id), work.id);
        }
      }
    }

    const now = new Date().toISOString();
    const records = [...aggregated.values()].map((row) => ({
      report_month: reportMonth,
      work_id: row.productId ? (workIdByProductId.get(row.productId) ?? null) : null,
      product_id: row.productId,
      title: row.title,
      sales_count: row.salesCount,
      sales_amount: row.salesAmount,
      commission_amount: row.commissionAmount,
      source_file: file.name.slice(0, 255),
      row_key: stableRowKey(reportMonth, row.productId, row.title),
      imported_at: now,
    }));

    for (let index = 0; index < records.length; index += UPSERT_CHUNK_SIZE) {
      const { error } = await supabaseAdmin
        .from("affiliate_sales")
        .upsert(records.slice(index, index + UPSERT_CHUNK_SIZE), {
          onConflict: "row_key",
        });
      if (error) {
        if (error.message.includes("affiliate_sales")) {
          throw new Error("売上テーブルがありません。先に20260817_add_affiliate_sales.sqlを実行してください。");
        }
        throw error;
      }
    }

    const matched = records.filter((row) => row.work_id !== null).length;
    return NextResponse.json({
      imported: records.length,
      matched,
      unmatched: records.length - matched,
      totalCommission: records.reduce((sum, row) => sum + row.commission_amount, 0),
    });
  } catch (error) {
    console.error("FANZA report import failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CSVの取込に失敗しました。" },
      { status: 500 },
    );
  }
}
