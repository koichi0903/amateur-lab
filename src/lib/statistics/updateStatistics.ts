import { supabaseAdmin as supabase } from "../supabaseAdmin";

const PAGE_SIZE = 1000;

async function getStatisticsWorks() {
  const works: Array<{
    id: number;
    actress: string | null;
    maker: string | null;
    series: string | null;
    genre: string | null;
  }> = [];
  let lastId = 0;

  // This runs at the end of the large score job. Use the service client and
  // keyset pagination so the summary pass does not hit the public query
  // timeout or become slower as the catalogue grows.
  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select("id,actress,maker,series,genre")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (error) throw error;
    if (!data?.length) break;

    works.push(...data);
    lastId = data[data.length - 1].id;
    if (data.length < PAGE_SIZE) break;
  }

  return works;
}

export async function updateStatistics() {
  const works = await getStatisticsWorks();

  const actressSet = new Set<string>();
  const makerSet = new Set<string>();
  const seriesSet = new Set<string>();
  const genreSet = new Set<string>();

  works.forEach((work) => {
    work.actress
      ?.split(" / ")
      .filter(Boolean)
      .forEach((name) => actressSet.add(name));

    if (work.maker) makerSet.add(work.maker);

    if (work.series) seriesSet.add(work.series);

    work.genre
      ?.split(" / ")
      .filter(Boolean)
      .forEach((genre) => genreSet.add(genre));
  });

  const { error } = await supabase
  .from("site_statistics")
  .update({
    total_works: works.length,
    total_actresses: actressSet.size,
    total_makers: makerSet.size,
    total_series: seriesSet.size,
    total_genres: genreSet.size,
    last_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq("id", 1);

  if (error) throw error;

}
