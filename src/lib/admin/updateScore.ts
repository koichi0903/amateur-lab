import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

console.log(
  "ENV CHECK:",
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

import { createClient } from "@supabase/supabase-js";
import { calculateScore } from "@/lib/score";
import type { DmmItem } from "@/types/dmm";
import { IGNORE_GENRES } from "@/lib/genre";
import { updateStatistics } from "@/lib/statistics/updateStatistics";
import { getActressRanking } from "@/lib/playwright/getActressRanking";
import { getSeriesRanking } from "@/lib/playwright/getSeriesRanking";
import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

type ScoreUpdateWork = {
  id: number;
  product_id: string;
  actress: string | null;
genre: string | null;
maker: string | null;
series: string | null;
  review_average: number | null;
  review_count: number | null;
  discount_rate: number | null;
max_discount_rate: number | null;

  realtime_rank: number | null;
daily_rank: number | null;
weekly_rank: number | null;
monthly_rank: number | null;
long_hit_rank: number | null;

actress_score: number | null;
  genre_score: number | null;
  maker_score: number | null;
  series_score: number | null;
  release_date: string | null;
};

function getRankingPoint(rank: number) {
  return Math.max(
    1,
    Math.floor(500 / Math.sqrt(rank))
  );
}

function getActressPoint(rank: number | null): number {
  if (!rank) return 0;

  if (rank <= 5) return 20;
  if (rank <= 10) return 19;
  if (rank <= 15) return 18;
  if (rank <= 20) return 17;
  if (rank <= 25) return 16;
  if (rank <= 30) return 15;
  if (rank <= 35) return 14;
  if (rank <= 40) return 13;
  if (rank <= 45) return 12;
  if (rank <= 50) return 11;
  if (rank <= 60) return 10;
  if (rank <= 70) return 8;
  if (rank <= 80) return 6;
  if (rank <= 90) return 4;
  if (rank <= 100) return 2;

  return 0;
}

function getMakerPoint(rank: number | null): number {
  if (!rank) return 0;

  if (rank <= 5) return 10;
  if (rank <= 10) return 9;
  if (rank <= 15) return 8;
  if (rank <= 20) return 7;
  if (rank <= 25) return 6;
  if (rank <= 30) return 5;
  if (rank <= 35) return 4;
  if (rank <= 40) return 3;
  if (rank <= 45) return 2;
  if (rank <= 50) return 1;

  return 0;
}

function getGenrePoint(rank: number | null): number {
  if (!rank) return 0;

  if (rank <= 3) return 10;
  if (rank <= 6) return 9;
  if (rank <= 9) return 8;
  if (rank <= 12) return 7;
  if (rank <= 15) return 6;
  if (rank <= 18) return 5;
  if (rank <= 21) return 4;
  if (rank <= 24) return 3;
  if (rank <= 27) return 2;
  if (rank <= 30) return 1;

  return 0;
}

function getSeriesPoint(rank: number | null): number {
  if (!rank) return 0;

  if (rank <= 3) return 10;
  if (rank <= 8) return 9;
  if (rank <= 13) return 8;
  if (rank <= 18) return 7;
  if (rank <= 23) return 6;
  if (rank <= 28) return 5;
  if (rank <= 33) return 4;
  if (rank <= 38) return 3;
  if (rank <= 44) return 2;
  if (rank <= 50) return 1;

  return 0;
}

async function fetchRanking(
  apiId: string,
  affiliateId: string,
  offset: number
): Promise<DmmItem[]> {
  const url =
    "https://api.dmm.com/affiliate/v3/ItemList" +
    `?api_id=${encodeURIComponent(apiId)}` +
    `&affiliate_id=${encodeURIComponent(affiliateId)}` +
    "&site=FANZA" +
    "&service=digital" +
    "&floor=videoa" +
    "&hits=100" +
    `&offset=${offset}` +
    "&sort=rank" +
    "&output=json";

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `DMMランキングAPI取得失敗: offset=${offset} status=${response.status}`
    );
  }

  const payload: unknown = await response.json();
  const items =
    typeof payload === "object" && payload !== null &&
    "result" in payload &&
    typeof payload.result === "object" && payload.result !== null &&
    "items" in payload.result
      ? payload.result.items
      : null;

  if (!Array.isArray(items)) {
    throw new Error(`DMMランキングAPIの応答形式が不正です: offset=${offset}`);
  }

  return items as DmmItem[];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncSimpleRanking(
  table: "genre_rankings" | "maker_rankings",
  rows: Array<{ name: string; rank: number; score: number; updated_at: Date }>
) {
  const { error: upsertError } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "name" });

  if (upsertError) throw upsertError;

  const { data: existingRows, error: selectError } = await supabase
    .from(table)
    .select("id,name");

  if (selectError) throw selectError;

  const currentNames = new Set(rows.map((row) => row.name));
  const staleIds = (existingRows ?? [])
    .filter((row) => !currentNames.has(row.name))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in("id", staleIds);

    if (deleteError) throw deleteError;
  }
}

export async function updateScore(
  productIds?: string[]
) {
  
  try {

    const apiId = process.env.DMM_API_ID?.trim();
const affiliateId = process.env.DMM_AFFILIATE_ID?.trim();

if (!apiId || !affiliateId) {
  throw new Error("DMM_API_ID または DMM_AFFILIATE_ID が未設定です");
}

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

  if (items.length !== 100) {
    throw new Error(
      `DMMランキングAPIの取得件数が不足しています: offset=${offset} count=${items.length}`
    );
  }

  allItems.push(...items);
}

const rankingItems = allItems.map(
  (item, index) => ({
    ...item,
    rank: index + 1,
  })
);

if (new Set(rankingItems.map((item) => item.content_id)).size !== 1000) {
  throw new Error("DMMランキング上位1000件を一意に取得できませんでした");
}

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
  .sort((a, b) => b[1] - a[1])
  .map(([name], index) => ({
    name,
    rank: index + 1,
  }));

const genreRanking = Object.entries(genreScore)
  .map(([name, score]) => ({
    genre: name,
    score,
  }))
  .sort((a, b) => b.score - a.score)
  .map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

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
  .sort((a, b) => b.score - a.score)
  .map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  // 既存のオリジナル順位をリセット
  const { error: clearError } = await supabase
    .from("actress_rankings")
    .update({
      original_rank: null,
    })
    .not("id", "is", null);
  
  if (clearError) {
    throw clearError;
  }
  
  for (const actress of actressRanking.slice(0, 100)) {
    const { data: existing, error: existingError } = await supabase
      .from("actress_rankings")
      .select("id")
      .eq("name", actress.name)
      .maybeSingle();

    if (existingError) throw existingError;
  
    if (existing) {
      const { error } = await supabase
        .from("actress_rankings")
        .update({
          original_rank: actress.rank,
          updated_at: new Date(),
        })
        .eq("id", existing.id);
  
      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("actress_rankings")
        .insert({
          name: actress.name,
          original_rank: actress.rank,
          fanza_rank: null,
          updated_at: new Date(),
        });
  
      if (error) {
        throw error;
      } else {
        console.log(`追加: ${actress.name}`);
      }
    }
  }
  
  console.log("女優ランキング更新完了");

await syncSimpleRanking(
  "genre_rankings",
  genreRanking.slice(0, 30).map((g) => ({
    name: g.genre,
    rank: g.rank,
    score: g.score,
    updated_at: new Date(),
  }))
);

await syncSimpleRanking(
  "maker_rankings",
  makerRanking.slice(0, 50).map((m, index) => ({
    name: m.maker,
    rank: index + 1,
    score: m.score,
    updated_at: new Date(),
  }))
);
  
  console.log("ランキング集計完了");
  
  const fanzaActressRanking = await getActressRanking();
  const fanzaSeriesRanking = await getSeriesRanking();
  
  // FANZA女優ランキング反映
  for (const actress of fanzaActressRanking) {
    const { data: existing, error: existingError } = await supabase
      .from("actress_rankings")
      .select("id")
      .eq("name", actress.name)
      .maybeSingle();

    if (existingError) throw existingError;
  
    if (existing) {
      const { error } = await supabase
        .from("actress_rankings")
        .update({
          fanza_rank: actress.rank,
          updated_at: new Date(),
        })
        .eq("id", existing.id);
  
      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("actress_rankings")
        .insert({
          name: actress.name,
          original_rank: null,
          fanza_rank: actress.rank,
          updated_at: new Date(),
        });
  
      if (error) {
        throw error;
      }
    }
  }
  
  // FANZAシリーズランキング反映
  for (const series of fanzaSeriesRanking) {
    const { data: existing, error: existingError } = await supabase
      .from("series_rankings")
      .select("id")
      .eq("name", series.name)
      .maybeSingle();

    if (existingError) throw existingError;
  
    if (existing) {
      const { error } = await supabase
        .from("series_rankings")
        .update({
          fanza_rank: series.rank,
          updated_at: new Date(),
        })
        .eq("id", existing.id);
  
      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("series_rankings")
        .insert({
    name: series.name,
    original_rank: null,
    fanza_rank: series.rank,
    score: 0,
    updated_at: new Date(),
  });
  
      if (error) {
        throw error;
      }
    }
  }

  // 既存のオリジナル順位をリセット
const { error: clearSeriesError } = await supabase
  .from("series_rankings")
  .update({
    original_rank: null,
  })
  .not("id", "is", null);

if (clearSeriesError) {
  throw clearSeriesError;
}

// オリジナルシリーズランキング反映
for (const series of seriesRanking.slice(0, 100)) {
  const { data: existing, error: existingError } = await supabase
    .from("series_rankings")
    .select("id")
    .eq("name", series.series)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from("series_rankings")
      .update({
        original_rank: series.rank,
        score: series.score,
        updated_at: new Date(),
      })
      .eq("id", existing.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("series_rankings")
      .insert({
        name: series.series,
        original_rank: series.rank,
        fanza_rank: null,
        score: series.score,
        updated_at: new Date(),
      });

    if (error) {
      throw error;
    }
  }
}

    const works: ScoreUpdateWork[] = [];
    const selectColumns = `
    id,
    product_id,
    actress,
    genre,
    maker,
    series,
    review_average,
        review_count,
        discount_rate,
max_discount_rate,
        actress_score,
        genre_score,
        maker_score,
        series_score,
        release_date,
        realtime_rank,
        daily_rank,
        weekly_rank,
        monthly_rank,
        long_hit_rank
    `;
    const limit = 1000;

    if (productIds && productIds.length > 0) {
      for (let i = 0; i < productIds.length; i += limit) {
        const { data, error } = await supabase
          .from("works")
          .select(selectColumns)
          .in("product_id", productIds.slice(i, i + limit));

        if (error) throw error;
        works.push(...((data ?? []) as ScoreUpdateWork[]));
      }
    } else {
      for (let from = 0; ; from += limit) {
        const { data, error } = await supabase
          .from("works")
          .select(selectColumns)
          .order("id", { ascending: true })
          .range(from, from + limit - 1);

        if (error) throw error;
        works.push(...((data ?? []) as ScoreUpdateWork[]));
        if (!data || data.length < limit) break;
      }
    }

  console.log("score更新対象:", works.length);

const { data: actressRanks, error: actressRanksError } = await supabase
  .from("actress_rankings")
  .select("name, original_rank, fanza_rank");

if (actressRanksError) throw actressRanksError;

const actressRankMap = new Map(
  (actressRanks ?? []).map((a) => {
    const ranks = [a.original_rank, a.fanza_rank].filter(
      (r): r is number => r != null
    );

    return [
      a.name,
      ranks.length ? Math.min(...ranks) : null,
    ];
  })
);

const { data: genreRanks, error: genreRanksError } = await supabase
  .from("genre_rankings")
  .select("name, rank");

if (genreRanksError) throw genreRanksError;

const genreRankMap = new Map(
  (genreRanks ?? []).map((g) => [
    g.name,
    g.rank,
  ])
);

const { data: makerRanks, error: makerRanksError } = await supabase
  .from("maker_rankings")
  .select("name, rank");

if (makerRanksError) throw makerRanksError;

const makerRankMap = new Map(
  (makerRanks ?? []).map((m) => [
    m.name,
    m.rank,
  ])
);

const { data: seriesRanks, error: seriesRanksError } = await supabase
  .from("series_rankings")
  .select("name, original_rank, fanza_rank");

if (seriesRanksError) throw seriesRanksError;

const seriesRankMap = new Map(
  (seriesRanks ?? []).map((s) => {
    const ranks = [s.original_rank, s.fanza_rank].filter(
      (r): r is number => r != null
    );

    return [
      s.name,
      ranks.length ? Math.min(...ranks) : null,
    ];
  })
);

  const job = await beginJob(
  JOBS.SCORE,
  works.length
);

let processed =
  Math.min(job.processed_count ?? 0, works.length);

  const targets = works.slice(processed);
  let workUpdates: Array<Record<string, number>> = [];
  let updatedCount = 0;

  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const work = targets[targetIndex];

    let actressScore = 0;
let genreScore = 0;
let makerScore = 0;
let seriesScore = 0;

const actresses =
  work.actress
    ?.split("/")
    .map((v) => v.trim()) ?? [];

const genres =
  work.genre
    ?.split("/")
    .map((v) => v.trim()) ?? [];

const makers =
  work.maker
    ?.split("/")
    .map((v) => v.trim()) ?? [];

const series =
  work.series
    ?.split("/")
    .map((v) => v.trim()) ?? [];

actresses.forEach((name) => {
  const rank = actressRankMap.get(name);

  if (rank) {
  actressScore = Math.max(
    actressScore,
    getActressPoint(rank)
  );
}
});

genres.forEach((name) => {
  const rank = genreRankMap.get(name);

  if (rank) {
    genreScore = Math.max(
      genreScore,
      getGenrePoint(rank)
    );
  }
});

makers.forEach((name) => {
  const rank = makerRankMap.get(name);

  if (rank) {
  makerScore = Math.max(
    makerScore,
    getMakerPoint(rank)
  );
}
});

series.forEach((name) => {
  const rank = seriesRankMap.get(name);

  if (rank) {
    seriesScore = Math.max(
      seriesScore,
      getSeriesPoint(rank)
    );
  }
});

    const result = calculateScore({
      reviewAverage: work.review_average || 0,
      reviewCount: work.review_count || 0,
      // スコアは過去最大ではなく、現在有効な割引率を反映する。
      maxDiscountRate: work.discount_rate || 0,

      actressPoint: actressScore,
genrePoint: genreScore,
makerPoint: makerScore,
seriesPoint: seriesScore,

      realtimeRank: work.realtime_rank,
dailyRank: work.daily_rank,
weeklyRank: work.weekly_rank,
monthlyRank: work.monthly_rank,
longHitRank: work.long_hit_rank,

releaseDate: work.release_date,
    });

    workUpdates.push({
  id: work.id,

  actress_score: actressScore,
  genre_score: genreScore,
  maker_score: makerScore,
  series_score: seriesScore,

  score: result.score,
      review_score: Math.round(result.reviewPoint),

      review_count_score: Math.round(
        result.reviewCountPoint
      ),

      discount_score: Math.round(
        result.discountPoint
      ),

      ranking_score: Math.round(
  result.popularityPoint
),

      new_release_score:
  result.newReleaseBonus,

long_hit_point:
  result.longHitPoint,

actress_point: Math.round(
  result.actressPoint
),

      genre_point: Math.round(
        result.genrePoint
      ),

      maker_point: Math.round(
        result.makerPoint
      ),

      series_point: Math.round(
        result.seriesPoint
      ),
    });
    if (workUpdates.length === 500 || targetIndex === targets.length - 1) {
      const batchSize = workUpdates.length;
      const { error: updateError } = await supabase
        .from("works")
        .upsert(workUpdates);

      if (updateError) throw updateError;

      processed += batchSize;
      updatedCount += batchSize;
      await updateJob(
        JOBS.SCORE,
        processed,
        String(work.id)
      );

      console.log(`[score] ${processed}/${works.length}`);
      workUpdates = [];
    }
  }

  console.log("スコア更新完了");

  await updateStatistics();

  console.log("統計更新完了");

await finishJob(JOBS.SCORE);

return {
  count: works.length,
  updates: updatedCount,
};

} catch (error) {
  await failJob(
    JOBS.SCORE,
    error instanceof Error
      ? error.message
      : "Unknown error"
  );

    throw error;
}
}
