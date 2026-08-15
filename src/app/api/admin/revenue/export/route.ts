import { fetchAffiliateClicks } from "@/lib/affiliateAnalytics";
import { AFFILIATE_SOURCE_LABELS } from "@/lib/affiliateTracking";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const result = await fetchAffiliateClicks(90);

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  const workIds = [...new Set(result.rows.map((row) => row.work_id))];
  const works = new Map<number, string>();
  for (let offset = 0; offset < workIds.length; offset += 500) {
    const { data } = await supabaseAdmin
      .from("works")
      .select("id,title")
      .in("id", workIds.slice(offset, offset + 500));
    for (const work of (data ?? []) as Array<{ id: number; title: string }>) {
      works.set(work.id, work.title);
    }
  }
  const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Tokyo",
  });
  const lines = [
    ["クリック日時（JST）", "作品ID", "作品名", "流入元", "CTA位置"],
    ...result.rows.map((row) => [
      dateTimeFormatter.format(new Date(row.clicked_at)),
      row.work_id,
      works.get(row.work_id) ?? `作品ID ${row.work_id}`,
      AFFILIATE_SOURCE_LABELS[row.source_page],
      row.placement,
    ]),
  ];
  const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="affiliate-clicks-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
