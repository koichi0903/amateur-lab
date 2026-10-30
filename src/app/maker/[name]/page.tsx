import type { Metadata } from "next";
import { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogMetadata";
import GenreDetailPage from "@/components/catalog/GenreDetailPage";

export const revalidate = 86400;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ sort?: string }> }): Promise<Metadata> {
  const [{ name }, query] = await Promise.all([params, searchParams]);
  return catalogMetadata("maker", decodeCatalogName(name), 1, query.sort);
}

export default async function MakerDetailPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ sort?: string }> }) {
  const [{ name }, query] = await Promise.all([params, searchParams]);
  const sort = ["popular", "release-desc", "release-asc", "price-asc", "price-desc"].includes(query.sort ?? "") ? query.sort as "popular" | "release-desc" | "release-asc" | "price-asc" | "price-desc" : "popular";
  return <GenreDetailPage kind="maker" genreName={decodeCatalogName(name)} currentPage={1} sort={sort} />;
}
