import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";

export type DailyDiscoveryWork = Pick<Work, "id" | "title" | "image_url">;

type DailyDiscovery = {
  work: DailyDiscoveryWork | null;
  eyebrow: string;
  reason: string;
};

const themes = [
  { eyebrow: "TODAY'S VALUE PICK", reason: "現在価格と発掘スコアのバランスから選定" },
  { eyebrow: "TODAY'S SALE PICK", reason: "値引率が高いセール対象から選定" },
  { eyebrow: "TODAY'S REVIEW PICK", reason: "評価だけでなくレビュー件数も含めて選定" },
  { eyebrow: "TODAY'S HIDDEN GEM", reason: "上位ランキングだけに偏らない高スコア作品" },
] as const;

export const getDailyDiscovery = unstable_cache(
  async (dateKey: string): Promise<DailyDiscovery> => {
    const seed = Number(dateKey.replaceAll("-", ""));
    const themeIndex = seed % themes.length;
    const offset = seed % 12;
    let query = supabase
      .from("works")
      .select("id,title,image_url")
      .not("image_url", "is", null)
      .neq("image_url", "");

    if (themeIndex === 0) {
      query = query.gt("price", 0).lte("price", 1000).order("score", { ascending: false, nullsFirst: false });
    } else if (themeIndex === 1) {
      query = query.eq("is_on_sale", true).order("discount_rate", { ascending: false, nullsFirst: false });
    } else if (themeIndex === 2) {
      query = query.gte("review_average", 4).gte("review_count", 10).order("review_count", { ascending: false, nullsFirst: false });
    } else {
      query = query.gte("score", 70).or("ranking.is.null,ranking.gt.100").order("score", { ascending: false, nullsFirst: false });
    }

    const result = await query.range(offset, offset).maybeSingle();
    if (result.data) return { work: result.data, ...themes[themeIndex] };

    const fallback = await supabase.from("works").select("id,title,image_url").order("score", { ascending: false }).limit(1).maybeSingle();
    return { work: fallback.data ?? null, eyebrow: "TODAY'S PICK", reason: "本日の発掘スコア上位から選定" };
  },
  ["home-daily-discovery"],
  { revalidate: 3600 },
);
