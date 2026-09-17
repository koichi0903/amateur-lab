import type { Metadata } from "next";
import CatalogDetailPage, { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogDetailPage";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ name: string; page: string }> }): Promise<Metadata> {
  const { name, page } = await params;
  return catalogMetadata("series", decodeCatalogName(name), Math.max(1, Number.parseInt(page, 10) || 1));
}

export default async function SeriesPaginatedPage({ params }: { params: Promise<{ name: string; page: string }> }) {
  const { name, page } = await params;
  return <CatalogDetailPage kind="series" name={decodeCatalogName(name)} page={Math.max(1, Number.parseInt(page, 10) || 1)} />;
}
