import type { Metadata } from "next";
import CatalogDetailPage, { catalogMetadata, decodeCatalogName } from "@/components/catalog/CatalogDetailPage";

export const revalidate = 86400;
export const dynamic = "force-static";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return catalogMetadata("maker", decodeCatalogName((await params).name), 1);
}

export default async function MakerDetailPage({ params }: { params: Promise<{ name: string }> }) {
  return <CatalogDetailPage kind="maker" name={decodeCatalogName((await params).name)} page={1} />;
}
