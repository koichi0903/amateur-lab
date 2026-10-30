import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AmateurActressDetailPage, amateurActressMetadata } from "@/components/catalog/AmateurActressDetailPage";
import { getCanonicalFanzaAmateurActressName } from "@/lib/dmm/fanzaAmateurActressCatalog";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return amateurActressMetadata(getCanonicalFanzaAmateurActressName(decodeURIComponent((await params).name)));
}

export default async function AmateurActressPage({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const canonicalName = getCanonicalFanzaAmateurActressName(name);
  if (canonicalName !== name) redirect(`/amateur/actress/${encodeURIComponent(canonicalName)}`);
  return <AmateurActressDetailPage actressName={canonicalName} currentPage={1} />;
}
