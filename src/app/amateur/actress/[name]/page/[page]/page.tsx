import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AmateurActressDetailPage, amateurActressMetadata } from "@/components/catalog/AmateurActressDetailPage";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ name: string; page: string }> }): Promise<Metadata> {
  const { name, page } = await params;
  return amateurActressMetadata(decodeURIComponent(name), Math.max(1, Number.parseInt(page, 10) || 1));
}

export default async function AmateurActressPaginatedPage({ params }: { params: Promise<{ name: string; page: string }> }) {
  const { name, page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) notFound();
  if (pageNumber === 1) redirect(`/amateur/actress/${encodeURIComponent(decodeURIComponent(name))}`);
  return <AmateurActressDetailPage actressName={decodeURIComponent(name)} currentPage={pageNumber} />;
}

