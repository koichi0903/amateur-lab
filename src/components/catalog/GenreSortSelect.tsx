"use client";

import { useRouter } from "next/navigation";
import type { GenreWorkSort } from "@/lib/catalog/entityWorks";

export default function GenreSortSelect({ value, basePath }: { value: GenreWorkSort; basePath: string }) {
  const router = useRouter();
  return <select id="genre-sort" aria-label="並び順" value={value} onChange={(event) => {
    const nextSort = event.target.value as GenreWorkSort;
    router.push(nextSort === "popular" ? basePath : `${basePath}?sort=${nextSort}`);
  }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">
    <option value="popular">人気順</option>
    <option value="release-desc">発売日が新しい順</option>
    <option value="release-asc">発売日が古い順</option>
    <option value="price-asc">価格が安い順</option>
    <option value="price-desc">価格が高い順</option>
  </select>;
}
