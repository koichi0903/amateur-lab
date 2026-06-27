"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import WorkCard from "../components/WorkCard";

export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    const { data, error } = await supabase
  .from("works")
  .select("*")
  .or(
    `title.ilike.%${keyword}%,genre.ilike.%${keyword}%,actress.ilike.%${keyword}%,product_id.ilike.%${keyword}%`
  )
  .order("score", { ascending: false });

console.log(data);
console.log(error);

setResults(data || []);
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">
        作品検索
      </h1>

      <input
        type="text"
        placeholder="作品名・女優名・品番・ジャンル"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        className="border-2 rounded-lg p-3 w-full max-w-xl text-lg"
      />

      <button
        onClick={handleSearch}
        className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-bold"
      >
        検索
      </button>

      {results.length > 0 && (
  <p className="mt-4 text-gray-600">
    {results.length}件見つかりました
  </p>
)}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
  {results.length === 0 && keyword !== "" && (
  <div className="mt-10 text-center text-gray-500">
    該当する作品が見つかりませんでした。
  </div>
)}
  
  {results.map((work) => (
  <WorkCard
    key={work.id}
    work={work}
  />
))}
</div>

    </main>
  );
}