import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sortByRevenuePotential } from "@/lib/revenueWeightedWorks";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";

export type AiDiscovery = {
  id: number;
  product_id: string;
  title: string;
  genre: string | null;
  image_url: string | null;
  sample_movie_url: string | null;
  sample_movie_allowed: boolean;
  price: number;
  sale_price: number;
  list_price: number | null;
  lowest_price: number | null;
  is_bottom_price: boolean;
  is_on_sale: boolean;
  discount_rate: number;
  review_average: number;
  review_count: number;
  score: number;
  ranking: number;
  realtime_rank: number | null;
  previous_realtime_rank: number | null;
  sale_end_at: string | null;
  reason: string;
  reasonType: "price" | "rank" | "review" | "score" | "hidden";
};

const columns = "id,product_id,title,genre,image_url,sample_movie_url,price,sale_price,list_price,lowest_price,is_bottom_price,is_on_sale,discount_rate,review_average,review_count,score,ranking,realtime_rank,previous_realtime_rank,sale_end_at";

function isOfficialSampleMovieUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.endsWith("dmm.co.jp") || hostname.endsWith("fanza.co.jp");
  } catch {
    return false;
  }
}

async function getAllowedSampleMovieKeys(works: Array<{ id: number; product_id: string; sample_movie_url: string | null }>) {
  const ids = works.map((work) => work.id);
  const productIds = works.map((work) => work.product_id).filter(Boolean);
  if (!ids.length) return new Set<string>();

  const [byWork, byProduct] = await Promise.all([
    supabaseAdmin
      .from("x_media_assets")
      .select("work_id,product_id,source_url,fetch_status,rights_status")
      .eq("account_handle", "hakkutsu_lab")
      .in("media_type", ["video", "sample_movie"])
      .in("work_id", ids),
    productIds.length
      ? supabaseAdmin
        .from("x_media_assets")
        .select("work_id,product_id,source_url,fetch_status,rights_status")
        .eq("account_handle", "hakkutsu_lab")
        .in("media_type", ["video", "sample_movie"])
        .in("product_id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (byWork.error || byProduct.error) {
    console.warn("[home] sample movie rights lookup unavailable; using image fallback");
    return new Set<string>();
  }

  const assets = [...(byWork.data ?? []), ...(byProduct.data ?? [])] as Array<{
    work_id: number | null;
    product_id: string | null;
    source_url: string;
    fetch_status: string | null;
    rights_status: string | null;
  }>;
  const allowed = new Set<string>();

  for (const work of works) {
    const url = work.sample_movie_url?.trim();
    if (!isOfficialSampleMovieUrl(url)) continue;
    const matchingAssets = assets.filter((asset) =>
      (asset.work_id === work.id || asset.product_id === work.product_id) && asset.source_url === url,
    );
    const usable = matchingAssets.length === 0 || matchingAssets.some((asset) =>
      asset.rights_status === "allowed" && asset.fetch_status !== "dead" && asset.fetch_status !== "forbidden",
    );
    if (usable) allowed.add(String(work.id));
  }
  return allowed;
}

function price(work: AiDiscovery) { return work.sale_price > 0 ? work.sale_price : work.price; }

function reason(work: AiDiscovery, used: Set<string>) {
  const current = price(work);
  const rise = work.previous_realtime_rank && work.realtime_rank ? work.previous_realtime_rank - work.realtime_rank : 0;
  const options: Array<[AiDiscovery["reasonType"], string, boolean]> = [
    ["price", `${Math.round(work.discount_rate)}%OFF。価格面で今チェックしたい作品です。`, work.discount_rate >= 20],
    ["rank", `ランキングが${rise}位上昇。いま注目度が伸びている作品です。`, rise >= 5],
    ["review", `評価${work.review_average.toFixed(1)}・レビュー${work.review_count}件。反応の確かさに注目です。`, work.review_average >= 4.2 && work.review_count >= 10],
    ["score", `発掘スコア${Math.round(work.score)}。複数の指標でおすすめできる作品です。`, work.score >= 70],
    ["hidden", "ランキングだけでは見つけにくい、注目候補として選びました。", current > 0],
  ];
  const selected = options.find(([type, , valid]) => valid && !used.has(type)) ?? options.find(([, , valid]) => valid) ?? options[4];
  used.add(selected[0]);
  return { reason: selected[1], reasonType: selected[0] };
}

async function fetchAiDiscoveries() {
  const base = () => supabase.from("works").select(columns)
    .not("image_url", "is", null).neq("image_url", "")
    .or(NON_VR_GENRE_OR_FILTER)
    .not("title", "ilike", "%VR%");
  const results = [];
  for (const query of [
    base().lte("ranking", 2000).order("score", { ascending: false, nullsFirst: false }).limit(80),
    base().lte("realtime_rank", 2000).order("score", { ascending: false, nullsFirst: false }).limit(80),
    base().gte("review_count", 10).gte("review_average", 4.2).order("score", { ascending: false, nullsFirst: false }).limit(80),
    base().gte("score", 60).order("score", { ascending: false, nullsFirst: false }).limit(80),
  ]) {
    results.push(await query);
  }
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  const works = [...new Map(
    results.flatMap((result) => result.data ?? []).map((work) => [work.id, work]),
  ).values()]
    .filter(isNonVrWork)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, 80);
  const revenueWeightedWorks = await sortByRevenuePotential(works, { limit: 80 });
  const allowedSampleMovieKeys = await getAllowedSampleMovieKeys(revenueWeightedWorks as AiDiscovery[]);
  const used = new Set<string>();
  return revenueWeightedWorks.map((work) => ({
    ...work,
    sample_movie_allowed: allowedSampleMovieKeys.has(String(work.id)),
    ...reason(work as AiDiscovery, used),
  })) as AiDiscovery[];
}

export const getAiDiscoveries = unstable_cache(fetchAiDiscoveries, ["ai-discoveries-v4-non-vr-revenue-weighted"], { revalidate: 3600, tags: ["ai-discoveries", "home-daily-discovery"] });
