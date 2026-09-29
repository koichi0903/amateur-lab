import type { Metadata } from "next";
import { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogMetadata";
import GenreDetailContent from "@/components/catalog/GenreDetailPage";

export const revalidate = 86400;
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return catalogMetadata("genre", decodeCatalogName((await params).name), 1);
}

export default async function GenreDetailPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ sort?: string }> }) {
  const [{ name }, query] = await Promise.all([params, searchParams]);
  const sort = ["popular", "release-desc", "release-asc", "price-asc", "price-desc"].includes(query.sort ?? "") ? query.sort as "popular" | "release-desc" | "release-asc" | "price-asc" | "price-desc" : "popular";
  return <GenreDetailContent genreName={decodeCatalogName(name)} currentPage={1} sort={sort} />;
}
