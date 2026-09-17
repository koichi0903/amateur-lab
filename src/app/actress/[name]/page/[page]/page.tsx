import type { Metadata } from "next";
import { ActressDetailPage, actressMetadata } from "@/components/catalog/ActressDetailPage";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ name: string; page: string }> }): Promise<Metadata> {
  const { name, page } = await params;
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  return actressMetadata(decodeURIComponent(name), currentPage);
}

export default async function ActressPaginatedPage({ params }: { params: Promise<{ name: string; page: string }> }) {
  const { name, page } = await params;
  return <ActressDetailPage actressName={decodeURIComponent(name)} currentPage={Math.max(1, Number.parseInt(page, 10) || 1)} />;
}
