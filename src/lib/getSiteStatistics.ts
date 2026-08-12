import { supabase } from "./supabase";

export async function getSiteStatistics() {
  const { data, error } = await supabase
  .from("site_statistics")
  .select("total_works,total_actresses,total_makers,total_series,total_genres,last_updated_at,updated_at")
  .eq("id", 1)
  .single();

  if (error) {
    throw error;
  }

  return data;
}
