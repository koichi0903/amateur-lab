import { createClient } from "@supabase/supabase-js";
import { IGNORE_GENRES } from "../../../lib/genre";
import type { DmmItem } from "@/types/dmm";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  

  async function fetchRanking(
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
const allItems: DmmItem[] = [];

for (let offset = 1; offset <= 901; offset += 100) {
  const items = await fetchRanking(offset);

  if (!items || items.length === 0) {
    break;
  }

  allItems.push(...items);
}

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

  

rankingItems.forEach(
  (item: DmmItem, index: number) => {
    const point = Math.max(1, 1000 - index);

    const genres =
      item.iteminfo?.genre || [];

    genres.forEach((g: { name: string }) => {
  if (IGNORE_GENRES.includes(g.name)) return;

  genreScore[g.name] =
    (genreScore[g.name] || 0) +
    point;
});
    const actresses =
  item.iteminfo?.actress?.map(
    (a: { name: string }) => a.name
  ) || [];

actresses.forEach((name) => {
  actressScore[name] =
    (actressScore[name] || 0) + point;
});

    const makers =
  item.iteminfo?.maker?.map(
    (m: { name: string }) => m.name
  ) || [];

makers.forEach((name) => {
  makerScore[name] =
    (makerScore[name] || 0) + point;
});

const series =
  item.iteminfo?.series?.map(
    (s: { name: string }) => s.name
  ) || [];

series.forEach((name) => {
  seriesScore[name] =
    (seriesScore[name] || 0) + point;
});
  }
);

const actressRanking = Object.entries(
  actressScore
)
  .map(([name, score]) => ({
    actress: name,
    score,
  }))
  .sort(
    (a, b) => b.score - a.score
  );

const ranking = Object.entries(
  genreScore
)
  .map(([name, score]) => ({
    genre: name,
    score,
  }))
  .sort(
    (a, b) => b.score - a.score
  );

const makerRanking = Object.entries(
  makerScore
)
  .map(([name, score]) => ({
    maker: name,
    score,
  }))
  .sort(
    (a, b) => b.score - a.score
  );

const seriesRanking =
  Object.entries(seriesScore)
    .map(([series, score]) => ({
      series,
      score,
    }))
    .sort(
  (
    a: { score: number },
    b: { score: number }
  ) =>
    b.score - a.score
);

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

await supabase
  .from("genre_rankings")
  .delete()
  .neq("id", 0);

await supabase
  .from("genre_rankings")
  .insert(
    ranking.slice(0, 30).map(
      (g) => ({
        name: g.genre,
        score: g.score,
        updated_at: new Date(),
      })
    )
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
  ranking.map((g) => [g.genre, g.score])
);

const makerScoreMap = new Map(
  makerRanking.map((m) => [m.maker, m.score])
);

const seriesScoreMap = new Map(
  seriesRanking.map((s) => [s.series, s.score])
);

  const { data: works } =
  await supabase
    .from("works")
    .select(
      "id, product_id, actress, genre, maker, series"
    );

  await supabase
  .from("works")
  .update({
    ranking: 9999,
  })
  .neq("id", 0);

const rankingUpdates = [];

for (const item of rankingItems) {
  rankingUpdates.push({
    product_id: item.content_id,
    ranking: item.rank,
  });
}

await supabase
  .from("works")
  .upsert(rankingUpdates, {
    onConflict: "product_id",
  });

  const workUpdates = [];

for (const work of works || []) {

  let actressScore = 0;
  let genreScore = 0;
  let makerScore = 0;
  let seriesScore = 0;

  const actresses =
    work.actress
      ?.split("/")
      .map((v: string) => v.trim()) || [];

  const genres =
    work.genre
      ?.split("/")
      .map((v: string) => v.trim()) || [];

  const makers =
  work.maker
    ?.split("/")
    .map((v: string) => v.trim()) || [];
    
  const series =
  work.series
    ?.split("/")
    .map((v: string) => v.trim()) || [];

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

return Response.json(
  ranking.slice(0, 30)
);
}