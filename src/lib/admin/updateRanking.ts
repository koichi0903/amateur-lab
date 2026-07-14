import { createClient } from "@supabase/supabase-js";
import type { DmmItem } from "@/types/dmm";

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
  console.log("===== ランキング更新開始 =====");

  const apiId = process.env.DMM_API_ID!;
  const affiliateId =
    process.env.DMM_AFFILIATE_ID!;

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

  console.log("===== ランキング取得完了 =====");

  const rankingItems = allItems.map(
  (item, index) => ({
    ...item,
    rank: index + 1,
  })
);

const genreScore: Record<string, number> = {};
const actressScore: Record<string, number> = {};
const makerScore: Record<string, number> = {};
const seriesScore: Record<string, number> = {};

for (const item of rankingItems) {
  const point = getRankingPoint(item.rank);

  item.iteminfo?.genre?.forEach((g) => {
    genreScore[g.name] =
      (genreScore[g.name] || 0) + point;
  });

  item.iteminfo?.actress?.forEach((a) => {
    actressScore[a.name] =
      (actressScore[a.name] || 0) + point;
  });

  item.iteminfo?.maker?.forEach((m) => {
    makerScore[m.name] =
      (makerScore[m.name] || 0) + point;
  });

  item.iteminfo?.series?.forEach((s) => {
    seriesScore[s.name] =
      (seriesScore[s.name] || 0) + point;
  });
}

const actressRanking = Object.entries(
  actressScore
)
  .map(([name, score]) => ({
    actress: name,
    score,
  }))
  .sort((a, b) => b.score - a.score);

const genreRanking = Object.entries(
  genreScore
)
  .map(([name, score]) => ({
    genre: name,
    score,
  }))
  .sort((a, b) => b.score - a.score);

const makerRanking = Object.entries(
  makerScore
)
  .map(([name, score]) => ({
    maker: name,
    score,
  }))
  .sort((a, b) => b.score - a.score);

const seriesRanking = Object.entries(
  seriesScore
)
  .map(([name, score]) => ({
    series: name,
    score,
  }))
  .sort((a, b) => b.score - a.score);

console.log({
  actress: actressRanking.length,
  genre: genreRanking.length,
  maker: makerRanking.length,
  series: seriesRanking.length,
});

console.log("ランキング集計完了");
}