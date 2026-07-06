import { supabase } from "./supabase";
import type { Work } from "@/types/work";

export async function getAllWorks(): Promise<Work[]> {
  const works: Work[] = [];

  let from = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
  .from("works")
  .select("*")
  .order("score", {
    ascending: false,
  })
  .range(from, from + limit - 1);

    if (error) throw error;

    if (!data || data.length === 0) break;

    works.push(...data);

    if (data.length < limit) break;

    from += limit;
  }

  return works;
}