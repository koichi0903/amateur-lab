import type { Metadata } from "next";
import EntityIndexPage from "@/components/catalog/EntityIndexPage";
export const revalidate = 3600;
export const metadata: Metadata = { title: "ジャンルランキング | 発掘LAB", description: "登録作品数と発掘スコアから注目のジャンルを探せます。", alternates: { canonical: "/genre" } };
export default function GenrePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) { return <EntityIndexPage kind="genre" searchParams={searchParams} />; }
