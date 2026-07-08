import { supabase } from "@/lib/supabase";
import { UPDATE_CONFIG } from "@/config/update";
import { updateWork } from "./updateWork";

export async function updateSemiNewWorks() {
  const today = new Date();

  const newBorder = new Date(today);
  newBorder.setDate(
    newBorder.getDate() - UPDATE_CONFIG.newReleaseDays
  );

  const semiBorder = new Date(today);
  semiBorder.setDate(
    semiBorder.getDate() -
      UPDATE_CONFIG.semiNewReleaseDays
  );

  const { data: works, error } = await supabase
    .from("works")
    .select("product_id, release_date")
    .lt(
      "release_date",
      newBorder.toISOString().slice(0, 10)
    )
    .gte(
      "release_date",
      semiBorder.toISOString().slice(0, 10)
    );

  if (error) {
    throw error;
  }

  if (!works || works.length === 0) {
    console.log("更新対象の準新作はありません");
    return;
  }

  console.log(`準新作 ${works.length}件 更新開始`);

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

  console.log("準新作更新完了");
}