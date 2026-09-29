import type { Metadata } from "next";
import { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogDetailPage";
import GenreDetailContent from "@/components/catalog/GenreDetailPage";

export const revalidate = 86400;
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ name: string; page: string }> }): Promise<Metadata> {
  const { name, page } = await params;
  return catalogMetadata("genre", decodeCatalogName(name), Math.max(1, Number.parseInt(page, 10) || 1));
}

export default async function GenrePaginatedPage({ params, searchParams }: { params: Promise<{ name: string; page: string }>; searchParams: Promise<{ sort?: string }> }) {
  const [{ name, page }, query] = await Promise.all([params, searchParams]);
  const sort = ["popular", "release-desc", "release-asc", "price-asc", "price-desc"].includes(query.sort ?? "") ? query.sort as "popular" | "release-desc" | "release-asc" | "price-asc" | "price-desc" : "popular";
  return <GenreDetailContent genreName={decodeCatalogName(name)} currentPage={Math.max(1, Number.parseInt(page, 10) || 1)} sort={sort} />;
}
