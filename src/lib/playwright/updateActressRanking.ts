import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getActressRanking } from "./getActressRanking";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateActressRanking() {
  const actresses = await getActressRanking();

  console.log(`取得件数: ${actresses.length}`);

  for (const actress of actresses) {
  const { data: existing } = await supabase
    .from("actress_rankings")
    .select("id")
    .eq("name", actress.name)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("actress_rankings")
      .update({
        fanza_rank: actress.rank,
        updated_at: new Date(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error(
        `更新失敗: ${actress.name}`,
        error.message
      );
    }
  } else {
    const { error } = await supabase
      .from("actress_rankings")
      .insert({
        name: actress.name,
        fanza_rank: actress.rank,
        original_rank: null,
        updated_at: new Date(),
      });

    if (error) {
      console.error(
        `追加失敗: ${actress.name}`,
        error.message
      );
    } else {
      console.log(`追加: ${actress.name}`);
    }
  }
}

  console.log("FANZA女優ランキング更新完了");
}

updateActressRanking().catch((error) => {
  console.error(error);
  process.exit(1);
});