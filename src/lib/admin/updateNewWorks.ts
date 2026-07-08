import { supabase } from "@/lib/supabase";
import { UPDATE_CONFIG } from "@/config/update";
import { updateWork } from "./updateWork";

export async function updateNewWorks() {
  const borderDate = new Date();

  borderDate.setDate(
    borderDate.getDate() - UPDATE_CONFIG.newReleaseDays
  );

  const { data: works, error } = await supabase
    .from("works")
    .select("product_id, release_date")
    .gte(
      "release_date",
      borderDate.toISOString().slice(0, 10)
    );

  if (error) {
    throw error;
  }

  if (!works || works.length === 0) {
    console.log("更新対象の新作はありません");
    return;
  }

  console.log(`新作 ${works.length}件 更新開始`);

  for (
    let i = 0;
    i < works.length;
    i += UPDATE_CONFIG.parallel
  ) {
    const batch = works.slice(
      i,
      i + UPDATE_CONFIG.parallel
    );

    await Promise.all(
      batch.map(async (work) => {
        try {
          await updateWork(work.product_id);

          console.log(`✓ ${work.product_id}`);
        } catch (error) {
          console.error(
            `✗ ${work.product_id}`,
            error
          );
        }
      })
    );
  }

  console.log("新作更新完了");
}