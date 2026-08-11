import type { Metadata } from "next";
import EntityIndexPage from "@/components/catalog/EntityIndexPage";
export const revalidate = 3600;
export const metadata: Metadata = { title: "メーカーランキング | 発掘LAB", description: "登録作品数と発掘スコアから注目のメーカーを探せます。", alternates: { canonical: "/maker" } };
export default function MakerPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) { return <EntityIndexPage kind="maker" searchParams={searchParams} />; }
