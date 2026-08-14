import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

type ActiveStage = "RESERVED" | "NEW" | "SEMI_NEW";

export async function restoreDiscontinuedWorks(
  productIds: string[],
  stage: ActiveStage,
): Promise<number> {
  const uniqueIds = [...new Set(productIds)].filter(Boolean);
  let restored = 0;

  for (let index = 0; index < uniqueIds.length; index += 500) {
    const batch = uniqueIds.slice(index, index + 500);
    const { data, error } = await supabase
      .from("works")
      .update({
        stage,
        playwright_status: "PENDING",
        updated_at: new Date(0).toISOString(),
      })
      .eq("stage", "DISCONTINUED")
      .in("product_id", batch)
      .select("product_id");

    if (error) throw error;
    restored += data?.length ?? 0;
  }

  if (restored > 0) console.log(`[RESTORED] ${restored} works -> ${stage}`);
  return restored;
}
