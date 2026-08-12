import { supabaseAdmin as supabase } from "../supabaseAdmin";
import { getAllWorks } from "../getAllWorks";

export async function updateStatistics() {
  const works = await getAllWorks();

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

  const { data, error } = await supabase
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

}
