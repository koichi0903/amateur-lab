import { createClient } from "@supabase/supabase-js";
import type { DmmItem } from "@/types/dmm";
import { IGNORE_GENRES } from "../genre";
import { updateWork } from "./updateWork";
import { saveDmmItem } from "./save";
import { UPDATE_CONFIG } from "@/config/update";
import {
  beginJob,
  updateJob,
  finishJob,
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
  try {
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

  console.log("ランキング取得完了");

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
  if (IGNORE_GENRES.includes(g.name)) return;

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

await supabase
  .from("actress_rankings")
  .delete()
  .neq("id", 0);

await supabase
  .from("actress_rankings")
  .insert(
    actressRanking
      .slice(0, 50)
      .map((a) => ({
        name: a.actress,
        score: a.score,
        updated_at: new Date(),
      }))
  );

console.log("女優ランキング更新完了");

console.log("ランキング集計完了");

await supabase
  .from("genre_rankings")
  .delete()
  .neq("id", 0);

await supabase
  .from("genre_rankings")
  .insert(
    genreRanking
      .slice(0, 30)
      .map((g) => ({
        name: g.genre,
        score: g.score,
        updated_at: new Date(),
      }))
  );

await supabase
  .from("maker_rankings")
  .delete()
  .neq("id", 0);

await supabase
  .from("maker_rankings")
  .insert(
    makerRanking
      .slice(0, 30)
      .map((m) => ({
        name: m.maker,
        score: m.score,
        updated_at: new Date(),
      }))
  );

await supabase
  .from("series_rankings")
  .delete()
  .neq("id", 0);

await supabase
  .from("series_rankings")
  .insert(
    seriesRanking
      .slice(0, 50)
      .map((s) => ({
        name: s.series,
        score: s.score,
        updated_at: new Date(),
      }))
  );

const actressScoreMap = new Map(
  actressRanking.map((a) => [a.actress, a.score])
);

const genreScoreMap = new Map(
  genreRanking.map((g) => [g.genre, g.score])
);

const makerScoreMap = new Map(
  makerRanking.map((m) => [m.maker, m.score])
);

const seriesScoreMap = new Map(
  seriesRanking.map((s) => [s.series, s.score])
);

const { data: works } = await supabase
  .from("works")
  .select("product_id");

  const workMap = new Set(
  (works ?? []).map((w) => w.product_id)
);

// worksへ登録・更新するのは人気100作品のみ
const rankingTargets =
  rankingItems.slice(0, 100);

const job = await beginJob(
  JOBS.RANKING,
  rankingTargets.length
);

let processed =
  job.processed_count ?? 0;

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
    saveDmmItem(item, {
      actressRanking: actressRanking.map((a) => ({
        name: a.actress,
        score: a.score,
      })),

      genreRanking: genreRanking.map((g) => ({
        name: g.genre,
        score: g.score,
      })),

      makerRanking: makerRanking.map((m) => ({
        name: m.maker,
        score: m.score,
      })),

      seriesRanking: seriesRanking.map((s) => ({
        name: s.series,
        score: s.score,
      })),
    })
  )
);

  newCount += results.filter(Boolean).length;

  console.log(
    `${Math.min(
      i + SAVE_BATCH_SIZE,
      newItems.length
    )}/${newItems.length}`
  );
}

console.log(
  `ランキング新規登録 ${newCount}件`
);

const { data: refreshedWorks } = await supabase
  .from("works")
  .select(
    `
    id,
    product_id,
    actress,
    genre,
    maker,
    series,
    playwright_status
    `
  );

const statusMap = new Map(
  (refreshedWorks ?? []).map((work) => [
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

const workUpdates: {
  id: number;
  actress_score: number;
  genre_score: number;
  maker_score: number;
  series_score: number;
}[] = [];

for (const work of refreshedWorks ?? [])
   {
  let actressScore = 0;
  let genreScore = 0;
  let makerScore = 0;
  let seriesScore = 0;

  const actresses =
    work.actress
      ?.split("/")
      .map((v: string) => v.trim()) ?? [];

  const genres =
    work.genre
      ?.split("/")
      .map((v: string) => v.trim()) ?? [];

  const makers =
    work.maker
      ?.split("/")
      .map((v: string) => v.trim()) ?? [];

  const series =
    work.series
      ?.split("/")
      .map((v: string) => v.trim()) ?? [];

  actresses.forEach((name: string) => {
    const score = actressScoreMap.get(name);

    if (score) {
      actressScore += score;
    }
  });

  genres.forEach((name: string) => {
    const score = genreScoreMap.get(name);

    if (score) {
      genreScore += score;
    }
  });

  makers.forEach((name: string) => {
    const score = makerScoreMap.get(name);

    if (score) {
      makerScore += score;
    }
  });

  series.forEach((name: string) => {
    const score = seriesScoreMap.get(name);

    if (score) {
      seriesScore += score;
    }
  });

  workUpdates.push({
    id: work.id,
    actress_score: actressScore,
    genre_score: genreScore,
    maker_score: makerScore,
    series_score: seriesScore,
  });
}

await supabase
  .from("works")
  .upsert(workUpdates);

console.log("works更新完了");

console.log("ランキング作品詳細更新開始");

const targets = rankingTargets.filter(
  (item) =>
    statusMap.get(item.content_id) !== "SALE"
);

console.log(
  `Playwright対象 ${targets.length}件`
);

const PLAYWRIGHT_BATCH_SIZE =
  UPDATE_CONFIG.parallel;

for (
  let i = 0;
  i < targets.length;
  i += PLAYWRIGHT_BATCH_SIZE
) {
  const batch = targets.slice(
    i,
    i + PLAYWRIGHT_BATCH_SIZE
  );

  await Promise.all(
    batch.map((item) =>
      updateWork(item.content_id, item)
    )
  );

  processed += batch.length;

await updateJob(
  JOBS.RANKING,
  processed,
  batch[batch.length - 1].content_id
);

  console.log(
    `Playwright ${Math.min(
      i + PLAYWRIGHT_BATCH_SIZE,
      targets.length
    )}/${targets.length}`
  );
}

console.log("ランキング作品詳細更新完了");

await finishJob(JOBS.RANKING);

console.log("===== ランキング更新完了 =====");

return genreRanking.slice(0, 30);

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