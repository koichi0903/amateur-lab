import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import AmateurTaxonomyPage from "@/components/catalog/AmateurTaxonomyPage";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const isCleanLanding = !params.q?.trim() && page === 1;
  return pageMetadata({
    title: "FANZA素人作品のジャンル検索 | 発掘LAB",
    description: "FANZA公式APIの登録情報をもとに、素人作品のジャンルと掲載作品数を一覧で確認できます。気になるジャンルから作品を探せます。",
    canonical: "/amateur/genre",
    robots: { index: isCleanLanding, follow: true },
  });
}

export default async function AmateurGenreRoute({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const sort = params.sort === "count-asc" ? "count-asc" : "count-desc";
  return <><Header /><AmateurTaxonomyPage kind="genre" query={params.q ?? ""} page={page} sort={sort} /></>;
}
