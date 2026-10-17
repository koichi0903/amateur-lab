import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import AmateurBrowsePage from "@/components/catalog/AmateurBrowsePage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "FANZA素人作品のセール | 発掘LAB", description: "DMM APIにキャンペーン情報がある素人作品を探します。", canonical: "/amateur/sale", robots: { index: false, follow: true } });

export default function AmateurSaleRoute({ searchParams }: { searchParams: Promise<{ page?: string; sort?: string; maxPrice?: string; minRating?: string }> }) {
  return <><Header /><AmateurBrowsePage mode="sale" searchParams={searchParams} /></>;
}
