import type { Metadata } from "next";
import CatalogDetailPage, { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogDetailPage";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return catalogMetadata("genre", decodeCatalogName((await params).name), 1);
}

export default async function GenreDetailPage({ params }: { params: Promise<{ name: string }> }) {
  return <CatalogDetailPage kind="genre" name={decodeCatalogName((await params).name)} page={1} />;
}
