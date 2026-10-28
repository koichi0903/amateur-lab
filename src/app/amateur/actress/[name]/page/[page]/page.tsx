import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AmateurActressDetailPage, amateurActressMetadata } from "@/components/catalog/AmateurActressDetailPage";
import { getCanonicalFanzaAmateurActressName } from "@/lib/dmm/fanzaAmateurCatalog";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ name: string; page: string }> }): Promise<Metadata> {
  const { name, page } = await params;
  return amateurActressMetadata(getCanonicalFanzaAmateurActressName(decodeURIComponent(name)), Math.max(1, Number.parseInt(page, 10) || 1));
}

export default async function AmateurActressPaginatedPage({ params }: { params: Promise<{ name: string; page: string }> }) {
  const { name, page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) notFound();
  const decodedName = decodeURIComponent(name);
  const canonicalName = getCanonicalFanzaAmateurActressName(decodedName);
  if (canonicalName !== decodedName) redirect(`/amateur/actress/${encodeURIComponent(canonicalName)}${pageNumber > 1 ? `/page/${pageNumber}` : ""}`);
  if (pageNumber === 1) redirect(`/amateur/actress/${encodeURIComponent(canonicalName)}`);
  return <AmateurActressDetailPage actressName={canonicalName} currentPage={pageNumber} />;
}

