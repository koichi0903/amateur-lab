import type { Metadata } from "next";
import GenreIndexPage from "@/components/catalog/GenreIndexPage";
import { pageMetadata } from "@/lib/seo";
export const revalidate = 86400;
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }): Promise<Metadata> { const p = await searchParams; const q = (p.q ?? "").trim(); const page = Math.max(1, Number.parseInt(p.page ?? "1", 10) || 1); return pageMetadata({ title: `${q ? `「${q}」のFANZAジャンル検索結果` : "FANZAジャンルランキング"}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`, description: "FANZA登録作品数と発掘スコアから注目のジャンルを探せます。", canonical: q ? "/genre" : `/genre${page > 1 ? `?page=${page}` : ""}`, robots: q ? { index: false, follow: true } : undefined }); }
export default function GenrePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }) { return <GenreIndexPage kind="genre" searchParams={searchParams} />; }
