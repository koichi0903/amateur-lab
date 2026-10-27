import type { Metadata } from "next";
import { AmateurActressDetailPage, amateurActressMetadata } from "@/components/catalog/AmateurActressDetailPage";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return amateurActressMetadata(decodeURIComponent((await params).name));
}

export default async function AmateurActressPage({ params }: { params: Promise<{ name: string }> }) {
  return <AmateurActressDetailPage actressName={decodeURIComponent((await params).name)} currentPage={1} />;
}
