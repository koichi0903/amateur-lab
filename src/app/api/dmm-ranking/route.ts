import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  

  async function fetchRanking(offset: number) {
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

  return data.result.items;
}
const allItems = [];

for (let offset = 1; offset <= 901; offset += 100) {
  const items = await fetchRanking(offset);
  allItems.push(...items);
}

console.log(allItems.length);


  

 const rankingItems = allItems.map(
  (item: any, index: number) => ({
    ...item,
    rank: index + 1,
  })
);

  const genreScore: Record<string, number> = {};
  const actressScore: Record<string, number> = {};

rankingItems.forEach(
  (item: any, index: number) => {
    const point = 100 - index;

    const genres =
      item.iteminfo?.genre || [];

    genres.forEach((g: any) => {
      genreScore[g.name] =
        (genreScore[g.name] || 0) +
        point;
    });
    const actresses =
  item.iteminfo?.actress || [];

actresses.forEach((a: any) => {
  actressScore[a.name] =
    (actressScore[a.name] || 0) +
    point;
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

  const actressScoreMap = new Map(
  actressRanking.map((a) => [a.actress, a.score])
);

const genreScoreMap = new Map(
  ranking.map((g) => [g.genre, g.score])
);

  const { data: works } =
  await supabase
    .from("works")
    .select(
      "id, product_id, actress, genre"
    );

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

  const actresses =
    work.actress
      ?.split("/")
      .map((v: string) => v.trim()) || [];

  const genres =
    work.genre
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

  workUpdates.push({
  id: work.id,
  actress_score: actressScore,
  genre_score: genreScore,
});
}

await supabase
  .from("works")
  .upsert(workUpdates);

return Response.json(
  ranking.slice(0, 30)
);
}