import type { AffiliatePerformanceRow } from "@/lib/affiliateSalesAnalytics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CandidateWork = {
  id: number;
  title: string;
  score: number | null;
  price: number | null;
  sale_price: number | null;
  list_price: number | null;
  discount_rate: number | null;
  review_average: number | null;
  review_count: number | null;
  release_date: string | null;
  stage: string | null;
};

export type XPostCandidate = {
  key: string;
  workId: number;
  title: string;
  category: "sales" | "deal" | "score" | "new";
  label: string;
  reason: string;
  postText: string;
};

const SELECT_COLUMNS = [
  "id",
  "title",
  "score",
  "price",
  "sale_price",
  "list_price",
  "discount_rate",
  "review_average",
  "review_count",
  "release_date",
  "stage",
].join(",");

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://hakkutsu-lab.com").replace(/\/$/, "");
}

function buildPostText(
  workId: number,
  title: string,
  lead: string,
  detail: string,
) {
  const url = `${siteUrl()}/works/${workId}?from=x`;
  return [
    lead,
    `「${truncate(title, 72)}」`,
    detail,
    "詳細・サンプルを確認👇",
    url,
    "#PR #FANZA",
  ].filter(Boolean).join("\n");
}

function currentPrice(work: CandidateWork) {
  const prices = [work.sale_price, work.price]
    .filter((value): value is number => typeof value === "number" && value > 0);
  return prices.length ? Math.min(...prices) : null;
}

function makeWorkCandidate(
  work: CandidateWork,
  category: XPostCandidate["category"],
): XPostCandidate {
  const price = currentPrice(work);

  if (category === "deal") {
    const discount = Math.round(work.discount_rate ?? 0);
    const priceText = price ? `現在¥${price.toLocaleString("ja-JP")}。` : "";
    return {
      key: `deal-${work.id}`,
      workId: work.id,
      title: work.title,
      category,
      label: "セール訴求",
      reason: `${discount}%OFF${price ? `・¥${price.toLocaleString("ja-JP")}` : ""}`,
      postText: buildPostText(
        work.id,
        work.title,
        `【${discount}%OFFの注目セール】`,
        `${priceText}終了前に価格と内容をチェック。`,
      ),
    };
  }

  if (category === "new") {
    return {
      key: `new-${work.id}`,
      workId: work.id,
      title: work.title,
      category,
      label: "新作訴求",
      reason: work.release_date ? `発売日 ${work.release_date.slice(0, 10)}` : "新作登録",
      postText: buildPostText(
        work.id,
        work.title,
        "【新作を発掘】",
        "新着作品から注目作をピックアップしました。",
      ),
    };
  }

  const review = work.review_average && work.review_count
    ? `評価${work.review_average.toFixed(1)}（${work.review_count}件）`
    : "";
  return {
    key: `score-${work.id}`,
    workId: work.id,
    title: work.title,
    category: "score",
    label: "AI発掘",
    reason: `発掘スコア${work.score ?? 0}点${review ? `・${review}` : ""}`,
    postText: buildPostText(
      work.id,
      work.title,
      `【発掘スコア${work.score ?? 0}点】`,
      review ? `${review}の注目作です。` : "価格・評価・人気推移から選んだ注目作です。",
    ),
  };
}

function makeSalesCandidate(row: AffiliatePerformanceRow): XPostCandidate {
  return {
    key: `sales-${row.workId}`,
    workId: row.workId,
    title: row.title,
    category: "sales",
    label: "販売実績",
    reason: `${row.salesCount}件販売・報酬¥${row.commissionAmount.toLocaleString("ja-JP")}`,
    postText: buildPostText(
      row.workId,
      row.title,
      "【実際に選ばれている注目作】",
      "発掘LAB経由で販売実績を確認。迷っている人向けに見どころを整理しました。",
    ),
  };
}

export async function getXPostCandidates(
  performance: AffiliatePerformanceRow[],
): Promise<{ candidates: XPostCandidate[]; error: string | null }> {
  const salesCandidates = performance
    .filter((row) => row.salesCount > 0)
    .slice(0, 4)
    .map(makeSalesCandidate);

  const [dealResult, scoreResult, newResult] = await Promise.all([
    supabaseAdmin
      .from("works")
      .select(SELECT_COLUMNS)
      .gt("discount_rate", 0)
      .order("discount_rate", { ascending: false, nullsFirst: false })
      .limit(12),
    supabaseAdmin
      .from("works")
      .select(SELECT_COLUMNS)
      .gt("score", 0)
      .order("score", { ascending: false, nullsFirst: false })
      .order("review_count", { ascending: false, nullsFirst: false })
      .limit(12),
    supabaseAdmin
      .from("works")
      .select(SELECT_COLUMNS)
      .eq("stage", "NEW")
      .order("release_date", { ascending: false, nullsFirst: false })
      .limit(12),
  ]);

  const errors = [dealResult.error, scoreResult.error, newResult.error]
    .filter(Boolean)
    .map((error) => error?.message);
  const seen = new Set<number>();
  const candidates: XPostCandidate[] = [];
  const add = (candidate: XPostCandidate) => {
    if (seen.has(candidate.workId)) return;
    seen.add(candidate.workId);
    candidates.push(candidate);
  };

  salesCandidates.forEach(add);
  ((dealResult.data ?? []) as unknown as CandidateWork[])
    .slice(0, 4)
    .map((work) => makeWorkCandidate(work, "deal"))
    .forEach(add);
  ((scoreResult.data ?? []) as unknown as CandidateWork[])
    .slice(0, 4)
    .map((work) => makeWorkCandidate(work, "score"))
    .forEach(add);
  ((newResult.data ?? []) as unknown as CandidateWork[])
    .slice(0, 4)
    .map((work) => makeWorkCandidate(work, "new"))
    .forEach(add);

  return {
    candidates: candidates.slice(0, 12),
    error: errors.length ? errors.join(" / ") : null,
  };
}
