import { supabase } from "@/lib/supabase";

export type ActressProfile = {
  dmm_actress_id: string;
  name: string;
  ruby: string | null;
  birthday: string | null;
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  cup: string | null;
  image_url_small: string | null;
  image_url_large: string | null;
};

export async function getActressProfiles(names: string[]) {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const profiles: ActressProfile[] = [];
  for (let index = 0; index < uniqueNames.length; index += 100) {
    const { data, error } = await supabase
      .from("actress_profiles")
      .select("dmm_actress_id,name,ruby,birthday,height_cm,bust_cm,waist_cm,hip_cm,cup,image_url_small,image_url_large")
      .in("name", uniqueNames.slice(index, index + 100));
    if (error) throw error;
    profiles.push(...((data ?? []) as ActressProfile[]));
  }
  return profiles;
}
