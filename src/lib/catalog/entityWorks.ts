import { cache } from "react";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import type { EntityIndexKind } from "./entityIndexSummaries";

export const ENTITY_PAGE_SIZE = 60;

async function loadEntityWorks(
  kind: EntityIndexKind,
  name: string,
  offset: number,
  limit: number,
) {
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
    error: result.error,
    works: (result.data ?? []) as Work[],
  };
}

async function loadEntityWorksPage(
  kind: EntityIndexKind,
  name: string,
  page: number,
) {
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * ENTITY_PAGE_SIZE;
  return loadEntityWorks(kind, name, from, ENTITY_PAGE_SIZE);
}

async function loadEntityContext(kind: EntityIndexKind, name: string) {
  return loadEntityWorks(kind, name, 0, 300);
}

export const getEntityWorksPage = cache(loadEntityWorksPage);
export const getEntityContext = cache(loadEntityContext);
