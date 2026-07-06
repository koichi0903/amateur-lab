import { supabase } from "./supabase";

export async function getSiteStatistics() {
  const { data, error } = await supabase
  .from("site_statistics")
  .select("*")
  .eq("id", 1)
  .single();

  if (error) {
    throw error;
  }

  return data;
}