import type { Metadata } from "next";
import CatalogDetailPage, { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogDetailPage";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return catalogMetadata("series", decodeCatalogName((await params).name), 1);
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ name: string }> }) {
  return <CatalogDetailPage kind="series" name={decodeCatalogName((await params).name)} page={1} />;
}
