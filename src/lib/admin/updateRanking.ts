import { createClient } from "@supabase/supabase-js";
import type { DmmItem } from "@/types/dmm";
import { updateTopRankingWorks } from "./updateTopRankingWorks";
import { saveDmmItem } from "./save";
import { generateAndSaveTrendingInsight } from "@/lib/insights/generateAndSaveTrending";
import {
  failJob,
  JOBS,
} from "@/lib/jobs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getRankingPoint(rank: number) {
  return Math.max(
    1,
    Math.floor(500 / Math.sqrt(rank))
  );
}

async function fetchRanking(
  apiId: string,
  affiliateId: string,
  offset: number
): Promise<DmmItem[]> {
  const url =
    "https://api.dmm.com/affiliate/v3/ItemList" +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    "&site=FANZA" +
    "&service=digital" +
    "&floor=videoa" +
    "&hits=100" +
    `&offset=${offset}` +
    "&sort=rank" +
    "&output=json";

  const res = await fetch(url);
  const data = await res.json();

  return data.result.items as DmmItem[];
}

export async function updateRanking() {
  console.log("① updateRanking開始");

  try {
    console.log("② try開始");

    console.log("===== ランキング更新開始 =====");

  console.log("③ 環境変数取得");

const apiId = process.env.DMM_API_ID!;
  const affiliateId =
    process.env.DMM_AFFILIATE_ID!;

  console.log("④ fetch開始前");

const allItems: DmmItem[] = [];

  for (
    let offset = 1;
    offset <= 901;
    offset += 100
  ) {
    const items = await fetchRanking(
      apiId,
      affiliateId,
      offset
    );

    if (!items.length) break;

    allItems.push(...items);
  }

  console.log(
    "ランキング取得件数:",
    allItems.length
  );

  console.log("ランキング取得完了");

  const rankingItems = allItems.map(
  (item, index) => ({
    ...item,
    rank: index + 1,
  })
);

const rankingTargets =
  rankingItems.slice(0, 100);

const productIds = rankingTargets.map(
  (item) => item.content_id
);

const { data: works } = await supabase
  .from("works")
  .select("product_id")
  .in("product_id", productIds);

const workMap = new Set(
  (works ?? []).map((w) => w.product_id)
);

const { data: worksForStatus } = await supabase
  .from("works")
  .select(`
    product_id,
    playwright_status
  `);

const statusMap = new Map(
  (worksForStatus ?? []).map((work) => [
    work.product_id,
    work.playwright_status,
  ])
);

await supabase
  .from("works")
  .update({
    ranking: 9999,
  })
  .neq("id", 0);

const rankingUpdates = rankingItems
  .filter((item) =>
    workMap.has(item.content_id)
  )
  .map((item) => ({
    product_id: item.content_id,
    ranking: item.rank,
  }));

const { error: rankingError } =
  await supabase
    .from("works")
    .upsert(rankingUpdates, {
      onConflict: "product_id",
    });

if (rankingError) {
  console.error(rankingError);
}



const newItems = rankingTargets.filter(
  (item) => !workMap.has(item.content_id)
);

console.log(
  `新規登録対象 ${newItems.length}件`
);

let newCount = 0;

const SAVE_BATCH_SIZE = 10;

for (
  let i = 0;
  i < newItems.length;
  i += SAVE_BATCH_SIZE
) {
  const batch = newItems.slice(
    i,
    i + SAVE_BATCH_SIZE
  );

  const results = await Promise.all(
    batch.map((item) =>
      saveDmmItem(item)
    )
  );

  newCount += results.filter(Boolean).length;
}

console.log(
  `ランキング新規登録 ${newCount}件`
);

await updateTopRankingWorks(rankingTargets);

console.log("===== ランキング更新完了 =====");

return rankingTargets;

} catch (error) {
  await failJob(
    JOBS.RANKING,
    error instanceof Error
      ? error.message
      : "Unknown error"
  );

  throw error;
}
}