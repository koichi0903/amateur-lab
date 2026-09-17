import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import type { EntityIndexKind } from "./entityIndexSummaries";

export const ENTITY_PAGE_SIZE = 60;

type EntityWorksResult = {
  error: { code: string; message: string; details: string; hint: string } | null;
  works: Work[];
};

const getCachedEntityWorks = unstable_cache(
  async function loadEntityWorks(
  kind: EntityIndexKind,
  name: string,
  offset: number,
  limit: number,
  ): Promise<EntityWorksResult> {
    const result = await supabase.rpc("get_entity_works_page", {
      p_kind: kind,
      p_name: name,
      p_offset: offset,
      p_limit: limit,
    });

    if (result.error) {
      console.error("[entity-works] failed to load works", {
        kind,
        name,
        offset,
        limit,
        code: result.error.code,
        message: result.error.message,
      });
    }

    return {
      error: result.error
        ? {
            code: result.error.code,
            message: result.error.message,
            details: result.error.details,
            hint: result.error.hint,
          }
        : null,
      works: (result.data ?? []) as Work[],
    };
  },
  ["entity-works-v1"],
  { revalidate: 900, tags: ["entity-works"] },
);

async function loadEntityWorksPage(
  kind: EntityIndexKind,
  name: string,
  page: number,
) {
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * ENTITY_PAGE_SIZE;
  return getCachedEntityWorks(kind, name, from, ENTITY_PAGE_SIZE);
}

async function loadEntityContext(kind: EntityIndexKind, name: string) {
  const chunks = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      getCachedEntityWorks(kind, name, index * ENTITY_PAGE_SIZE, ENTITY_PAGE_SIZE),
    ),
  );

  return {
    error: chunks.find((chunk) => chunk.error)?.error ?? null,
    works: chunks.flatMap((chunk) => chunk.works),
  };
}

export const getEntityWorksPage = cache(loadEntityWorksPage);
export const getEntityContext = cache(loadEntityContext);
