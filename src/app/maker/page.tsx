import type { Metadata } from "next";
import GenreIndexPage from "@/components/catalog/GenreIndexPage";
import { pageMetadata } from "@/lib/seo";
export const revalidate = 86400;
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }): Promise<Metadata> { const p = await searchParams; const q = (p.q ?? "").trim(); const page = Math.max(1, Number.parseInt(p.page ?? "1", 10) || 1); return pageMetadata({ title: `${q ? `「${q}」のFANZAメーカー検索結果` : "FANZAメーカー検索｜登録作品数順に一覧"}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`, description: "FANZAメーカーを登録作品数の多い順・少ない順で一覧。気になるメーカーから作品を探せます。", canonical: q ? "/maker" : `/maker${page > 1 ? `?page=${page}` : ""}`, robots: q ? { index: false, follow: true } : undefined }); }
export default function MakerPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) { return <GenreIndexPage kind="maker" searchParams={searchParams} />; }
