import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";

export type DailyDiscoveryWork = Pick<
  Work,
  | "id" | "title" | "image_url" | "price" | "sale_price" | "list_price"
  | "discount_rate" | "review_average" | "review_count" | "score"
  | "ranking" | "realtime_rank" | "previous_realtime_rank"
>;

type DailyDiscovery = {
  work: DailyDiscoveryWork | null;
  eyebrow: string;
  reason: string;
};

const themes = [
  "TODAY'S VALUE PICK",
  "TODAY'S SALE PICK",
  "TODAY'S REVIEW PICK",
  "TODAY'S HIDDEN GEM",
] as const;

function currentPrice(work: DailyDiscoveryWork) {
  return work.sale_price > 0 ? work.sale_price : work.price;
}

function buildReason(work: DailyDiscoveryWork, themeIndex: number) {
  const price = currentPrice(work);
  const discount = Math.max(0, Math.round(work.discount_rate ?? 0));
  const rank = work.realtime_rank ?? work.ranking;
  const rankRise = work.previous_realtime_rank && rank
    ? work.previous_realtime_rank - rank
    : 0;

  if (discount >= 50) return `通常価格から${discount}%OFF。今チェックしたいセール作品です。`;
  if (work.list_price && price > 0 && work.list_price > price) {
    return `通常価格${work.list_price.toLocaleString("ja-JP")}円よりお得な価格で購入できます。`;
  }
  if (rankRise >= 10) return `ランキングが前回より${rankRise}位上昇。いま注目度が伸びています。`;
  if (rank && rank <= 50) return `ランキング${rank}位。人気と価格をまとめて確認したい作品です。`;
  if (work.review_average >= 4.5 && work.review_count >= 20) {
    return `評価${work.review_average.toFixed(1)}、レビュー${work.review_count.toLocaleString("ja-JP")}件の高評価作品です。`;
  }
  if (work.review_average >= 4 && work.review_count >= 10) {
    return `評価${work.review_average.toFixed(1)}、レビュー${work.review_count.toLocaleString("ja-JP")}件で安定した人気があります。`;
  }
  if (work.score >= 80) return `発掘スコア${Math.round(work.score)}。ランキングだけでは見つけにくい注目作です。`;
  if (price > 0 && price <= 1000) return `${price.toLocaleString("ja-JP")}円で手に取りやすい価格です。`;

  return [
    "価格・評価・人気のバランスから今日の候補に選びました。",
    "セールと作品評価を横断して、今日チェックしたい候補です。",
    "レビュー数と評価の両方を見て選んだ注目作品です。",
    "ランキング上位だけに偏らず、発掘スコアから選びました。",
  ][themeIndex] ?? "価格・評価・人気のバランスから選定しています。";
}

const WORK_COLUMNS = "id,title,image_url,price,sale_price,list_price,discount_rate,review_average,review_count,score,ranking,realtime_rank,previous_realtime_rank";

export const getDailyDiscovery = unstable_cache(
  async (dateKey: string): Promise<DailyDiscovery> => {
    const seed = Number(dateKey.replaceAll("-", ""));
    const themeIndex = seed % themes.length;
    const offset = seed % 12;
    let query = supabase
      .from("works")
      .select(WORK_COLUMNS)
      .not("image_url", "is", null)
      .neq("image_url", "");

    if (themeIndex === 0) {
      query = query.gt("price", 0).lte("price", 1000).order("score", { ascending: false, nullsFirst: false });
    } else if (themeIndex === 1) {
      query = query.eq("is_on_sale", true).order("discount_rate", { ascending: false, nullsFirst: false });
    } else if (themeIndex === 2) {
      query = query.gte("review_average", 4).gte("review_count", 10).order("review_count", { ascending: false, nullsFirst: false });
    } else {
      query = query.gte("score", 70).or("ranking.is.null,ranking.gt.100").order("score", { ascending: false, nullsFirst: false });
    }

    const result = await query.range(offset, offset).maybeSingle();
    if (result.data) {
      return { work: result.data, eyebrow: themes[themeIndex], reason: buildReason(result.data, themeIndex) };
    }

    const fallback = await supabase.from("works").select(WORK_COLUMNS).order("score", { ascending: false }).limit(1).maybeSingle();
    return {
      work: fallback.data ?? null,
      eyebrow: "TODAY'S PICK",
      reason: fallback.data ? buildReason(fallback.data, 0) : "価格・評価・人気のバランスから選定しています。",
    };
  },
  ["home-daily-discovery"],
  { revalidate: 3600, tags: ["home-daily-discovery"] },
);
