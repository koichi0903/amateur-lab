import { supabase } from "./supabase";

export type StatisticsWork = {
  actress: string | null;
  maker: string | null;
  series: string | null;
  genre: string | null;
};

export async function getAllWorks(): Promise<StatisticsWork[]> {
  const works: StatisticsWork[] = [];

  let from = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
  .from("works")
  .select("actress,maker,series,genre")
  .range(from, from + limit - 1);

    if (error) throw error;

    if (!data || data.length === 0) break;

    works.push(...data);

    if (data.length < limit) break;

    from += limit;
  }

  return works;
}
