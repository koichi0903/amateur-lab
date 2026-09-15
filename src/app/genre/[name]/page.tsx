import type { Metadata } from "next";
import CatalogDetailPage, { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogDetailPage";

export const revalidate = 86400;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  return catalogMetadata("genre", decodeCatalogName((await params).name), page);
}

export default async function GenreDetailPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number.parseInt((await searchParams).page ?? "1", 10);
  return <CatalogDetailPage kind="genre" name={decodeCatalogName((await params).name)} page={Number.isFinite(requestedPage) ? requestedPage : 1} />;
}
