import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import AmateurBrowsePage from "@/components/catalog/AmateurBrowsePage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "FANZA素人作品の詳細検索 | 発掘LAB", description: "素人作品だけを作品名・品番・ジャンルで検索します。", canonical: "/amateur/search", robots: { index: false, follow: true } });

export default function AmateurSearchRoute({ searchParams }: { searchParams: Promise<{ q?: string; genre?: string; genres?: string; maker?: string; page?: string; sort?: string; releaseFrom?: string; releaseTo?: string; minPrice?: string }> }) {
  return <><Header /><AmateurBrowsePage mode="search" searchParams={searchParams} /></>;
}
