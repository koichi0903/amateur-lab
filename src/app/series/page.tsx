import type { Metadata } from "next";
import EntityIndexPage from "@/components/catalog/EntityIndexPage";
import { pageMetadata } from "@/lib/seo";
export const revalidate = 3600;
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }): Promise<Metadata> { const p = await searchParams; const q = (p.q ?? "").trim(); const page = Math.max(1, Number.parseInt(p.page ?? "1", 10) || 1); return pageMetadata({ title: `${q ? `「${q}」のシリーズ検索結果` : "シリーズランキング"}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`, description: "登録作品数と発掘スコアから注目のシリーズを探せます。", canonical: q ? "/series" : `/series${page > 1 ? `?page=${page}` : ""}`, robots: q ? { index: false, follow: true } : undefined }); }
export default function SeriesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) { return <EntityIndexPage kind="series" searchParams={searchParams} />; }
