import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import type { EntityIndexKind } from "./entityIndexSummaries";

export const ENTITY_PAGE_SIZE = 60;
export const CATALOG_PAGE_SIZE = 24;
export type GenreWorkSort = "popular" | "release-desc" | "release-asc" | "price-asc" | "price-desc";
export type CatalogWorkKind = "genre" | "maker";

type EntityWorksResult = {
  error: { code: string; message: string; details: string; hint: string } | null;
  works: Work[];
};

type GenreWorksResult = EntityWorksResult & { totalCount: number };

const genreWorkSelect = "id,product_id,title,image_url,score,review_average,review_count,price,sale_price,list_price,discount_rate,actress,genre,maker,series,release_date,product_release_date,sale_end_at,affiliate_url";

function genrePattern(name: string) {
  return `%${name.replace(/[\\%_]/g, "\\$&")}%`;
}

async function loadCatalogWorksPage(kind: CatalogWorkKind, name: string, page: number, sort: GenreWorkSort = "popular"): Promise<GenreWorksResult> {
  const currentPage = Math.max(1, page);
  const from = (currentPage - 1) * CATALOG_PAGE_SIZE;
  if (sort === "price-asc" || sort === "price-desc") {
    type PriceRow = { id: number; price: number | null; sale_price: number | null };
    const priceRows: PriceRow[] = [];
    const batchSize = 1000;
    for (let offset = 0; offset < 100000; offset += batchSize) {
      const batch = await supabase
        .from("works")
        .select("id,price,sale_price")
        .ilike(kind, genrePattern(name))
        .neq("stage", "DISCONTINUED")
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (batch.error) {
        console.error(`[${kind}-works] failed to load price rows`, { name, page, sort, code: batch.error.code, message: batch.error.message });
        return { error: { code: batch.error.code, message: batch.error.message, details: batch.error.details, hint: batch.error.hint }, works: [], totalCount: 0 };
      }
      const rows = (batch.data ?? []) as PriceRow[];
      priceRows.push(...rows);
      if (rows.length < batchSize) break;
    }
    const currentPrice = (row: PriceRow) => row.sale_price != null && row.sale_price > 0 ? row.sale_price : row.price ?? 0;
    priceRows.sort((a, b) => sort === "price-asc" ? currentPrice(a) - currentPrice(b) || b.id - a.id : currentPrice(b) - currentPrice(a) || b.id - a.id);
    const pageIds = priceRows.slice(from, from + CATALOG_PAGE_SIZE).map((row) => row.id);
    if (!pageIds.length) return { error: null, works: [], totalCount: priceRows.length };
    const result = await supabase.from("works").select(genreWorkSelect).in("id", pageIds);
    if (result.error) {
      console.error(`[${kind}-works] failed to load sorted works`, { name, page, sort, code: result.error.code, message: result.error.message });
      return { error: { code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint }, works: [], totalCount: priceRows.length };
    }
    const byId = new Map((result.data ?? []).map((work) => [work.id, work]));
    return { error: null, works: pageIds.map((id) => byId.get(id)).filter(Boolean) as Work[], totalCount: priceRows.length };
  }
  let query = supabase
    .from("works")
    .select(genreWorkSelect, { count: "exact" })
    .ilike(kind, genrePattern(name))
    .neq("stage", "DISCONTINUED");
  if (sort === "release-desc") query = query.order("release_date", { ascending: false, nullsFirst: false }).order("product_release_date", { ascending: false, nullsFirst: false });
  else if (sort === "release-asc") query = query.order("release_date", { ascending: true, nullsFirst: false }).order("product_release_date", { ascending: true, nullsFirst: false });
  else query = query.order("score", { ascending: false, nullsFirst: false });
  const result = await query.order("id", { ascending: false }).range(from, from + CATALOG_PAGE_SIZE - 1);

  if (result.error) {
    console.error(`[${kind}-works] failed to load works`, { name, page, sort, code: result.error.code, message: result.error.message });
  }
  return {
    error: result.error
      ? { code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint }
      : null,
    works: (result.data ?? []) as Work[],
    totalCount: result.count ?? 0,
  };
}

async function loadGenreContext(name: string) {
  const result = await supabase
    .from("works")
    .select(genreWorkSelect)
    .ilike("genre", genrePattern(name))
    .neq("stage", "DISCONTINUED")
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("product_release_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(0, 299);
  return { error: result.error, works: (result.data ?? []) as Work[] };
}

export const getCatalogWorksPage = cache(loadCatalogWorksPage);
export const getGenreWorksPage = cache((name: string, page: number, sort: GenreWorkSort = "popular") => loadCatalogWorksPage("genre", name, page, sort));
export const getGenreContext = cache(loadGenreContext);

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

const getCachedActressWorks = unstable_cache(
  async function loadActressWorks(
    name: string,
    offset: number,
    limit: number,
  ): Promise<EntityWorksResult> {
    const result = await supabase.rpc("get_actress_works_page", {
      p_name: name,
      p_offset: offset,
      p_limit: limit,
    });

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
  ["actress-works-v1"],
  { revalidate: 900, tags: ["actress-works"] },
);

async function loadActressWorksPage(name: string, page: number) {
  const currentPage = Math.max(1, page);
  return getCachedActressWorks(name, (currentPage - 1) * ENTITY_PAGE_SIZE, ENTITY_PAGE_SIZE);
}

async function loadActressContext(name: string) {
  const chunks = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      getCachedActressWorks(name, index * ENTITY_PAGE_SIZE, ENTITY_PAGE_SIZE),
    ),
  );

  return {
    error: chunks.find((chunk) => chunk.error)?.error ?? null,
    works: chunks.flatMap((chunk) => chunk.works),
  };
}

export const getActressWorksPage = cache(loadActressWorksPage);
export const getActressContext = cache(loadActressContext);
