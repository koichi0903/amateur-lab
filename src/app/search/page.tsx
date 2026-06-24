"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

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
        className="border p-2 w-full max-w-md"
      />

      <button
        onClick={handleSearch}
        className="bg-black text-white px-4 py-2 ml-2 rounded"
      >
        検索
      </button>

      <div className="mt-8">
        {results.map((work) => (
          <div
            key={work.id}
            className="border p-4 mb-3 rounded"
          >
            <Link href={`/works/${work.id}`}>
              <p className="font-bold text-blue-600 hover:underline">
                {work.title}
              </p>
            </Link>

           <p>
  ジャンル: {
    work.genre
      ?.split(" / ")
      .slice(0, 4)
      .join(" / ")
  }
  {work.genre?.split(" / ").length > 4 && " ..."}
</p>
            <p>スコア: {work.score}</p>
          </div>
        ))}
      </div>
    </main>
  );
}