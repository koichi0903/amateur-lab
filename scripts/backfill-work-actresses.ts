import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { formatDmmActresses } from "@/lib/dmm/actresses";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const concurrency = Math.max(1, Number(process.env.BACKFILL_CONCURRENCY ?? 4));

type WorkRow = { id: number; product_id: string; actress: string | null };

async function getWorks(): Promise<WorkRow[]> {
  const works: WorkRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("works")
      .select("id,product_id,actress")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    works.push(...((data ?? []) as WorkRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return works;
}

async function main() {
  const productId = process.env.BACKFILL_PRODUCT_ID;
  const minimumLength = Number(process.env.BACKFILL_MIN_LENGTH ?? 0);
  const works = (await getWorks()).filter((work) => {
    if (productId) return work.product_id === productId;
    if (minimumLength > 0) {
      return Boolean(
        work.actress &&
          !work.actress.includes(" / ") &&
          work.actress.length >= minimumLength
      );
    }
    return true;
  });
  let cursor = 0;
  let updated = 0;
  let unchanged = 0;
  let unavailable = 0;
  let failed = 0;

  async function worker() {
    while (true) {
      const work = works[cursor++];
      if (!work) return;
      try {
        let item = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            item = await getDmmItem(work.product_id);
            break;
          } catch (error) {
            if (attempt === 3) throw error;
            await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
          }
        }
        const actress = item ? formatDmmActresses(item) : null;
        if (actress == null) {
          unavailable++;
          continue;
        }
        if (actress === work.actress) {
          unchanged++;
          continue;
        }
        const { error } = await supabase.from("works").update({ actress }).eq("id", work.id);
        if (error) throw error;
        updated++;
      } catch (error) {
        failed++;
        console.error(`[FAILED] ${work.id} ${work.product_id}`, error);
      }
      const processed = updated + unchanged + unavailable + failed;
      if (processed % 100 === 0) {
        console.log({ processed, total: works.length, updated, unchanged, unavailable, failed });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log({ total: works.length, updated, unchanged, unavailable, failed });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
