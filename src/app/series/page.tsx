import type { Metadata } from "next";
import EntityIndexPage from "@/components/catalog/EntityIndexPage";
export const revalidate = 3600;
export const metadata: Metadata = { title: "シリーズランキング | 発掘LAB", description: "登録作品数と発掘スコアから注目のシリーズを探せます。", alternates: { canonical: "/series" } };
export default function SeriesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) { return <EntityIndexPage kind="series" searchParams={searchParams} />; }
