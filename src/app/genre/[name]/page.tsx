import type { Metadata } from "next";
import CatalogDetailPage, { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogDetailPage";

export const revalidate = 1800;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return catalogMetadata("genre", decodeCatalogName((await params).name));
}

export default async function GenreDetailPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number.parseInt((await searchParams).page ?? "1", 10);
  return <CatalogDetailPage kind="genre" name={decodeCatalogName((await params).name)} page={Number.isFinite(requestedPage) ? requestedPage : 1} />;
}
