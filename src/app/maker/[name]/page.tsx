import type { Metadata } from "next";
import CatalogDetailPage, { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogDetailPage";

export const revalidate = 1800;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return catalogMetadata("maker", decodeCatalogName((await params).name));
}

export default async function MakerDetailPage({ params }: { params: Promise<{ name: string }> }) {
  return <CatalogDetailPage kind="maker" name={decodeCatalogName((await params).name)} />;
}
