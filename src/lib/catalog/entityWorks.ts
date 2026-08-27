import { cache } from "react";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import type { EntityIndexKind } from "./entityIndexSummaries";

export const ENTITY_PAGE_SIZE = 60;

const ENTITY_WORK_COLUMNS =
  "id,title,image_url,score,review_average,review_count,price,sale_price,discount_rate,actress,genre,maker,series";

const entityColumns: Record<EntityIndexKind, "actress" | "maker" | "series" | "genre"> = {
  actress: "actress",
  maker: "maker",
  series: "series",
  genre: "genre",
};

function splitValues(value: string | null) {
  return value
    ?.split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/)
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function hasExactEntity(work: Work, kind: EntityIndexKind, name: string) {
  if (kind === "maker" || kind === "series") return true;
  return splitValues(work[kind]).includes(name);
}

async function loadEntityWorksPage(
  kind: EntityIndexKind,
  name: string,
  page: number,
) {
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * ENTITY_PAGE_SIZE;
  const column = entityColumns[kind];
  const query = supabase.from("works").select(ENTITY_WORK_COLUMNS);
  const result = kind === "actress" || kind === "genre"
    ? await query
        .ilike(column, `%${name}%`)
        .order("score", { ascending: false, nullsFirst: false })
        .range(from, from + ENTITY_PAGE_SIZE - 1)
    : await query
        .eq(column, name)
        .order("score", { ascending: false, nullsFirst: false })
        .range(from, from + ENTITY_PAGE_SIZE - 1);

  if (result.error) {
    console.error("[entity-works] failed to load page", {
      kind,
      name,
      page: currentPage,
      code: result.error.code,
      message: result.error.message,
    });
  }

  const works = ((result.data ?? []) as Work[]).filter((work) =>
    hasExactEntity(work, kind, name),
  );
  return { error: result.error, works };
}

async function loadEntityContext(kind: EntityIndexKind, name: string) {
  const column = entityColumns[kind];
  const query = supabase.from("works").select(ENTITY_WORK_COLUMNS);
  const result = kind === "actress" || kind === "genre"
    ? await query
        .ilike(column, `%${name}%`)
        .order("score", { ascending: false, nullsFirst: false })
        .limit(300)
    : await query
        .eq(column, name)
        .order("score", { ascending: false, nullsFirst: false })
        .limit(300);

  if (result.error) {
    console.error("[entity-works] failed to load context", {
      kind,
      name,
      code: result.error.code,
      message: result.error.message,
    });
  }

  const works = ((result.data ?? []) as Work[]).filter((work) =>
    hasExactEntity(work, kind, name),
  );
  return { error: result.error, works };
}

export const getEntityWorksPage = cache(loadEntityWorksPage);
export const getEntityContext = cache(loadEntityContext);

