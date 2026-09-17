import type { Metadata } from "next";
import { ActressDetailPage, actressMetadata } from "@/components/catalog/ActressDetailPage";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return actressMetadata(decodeURIComponent((await params).name));
}

export default async function ActressPage({ params }: { params: Promise<{ name: string }> }) {
  return <ActressDetailPage actressName={decodeURIComponent((await params).name)} currentPage={1} />;
}
