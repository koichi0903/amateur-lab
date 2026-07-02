"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import RankingCard from "../components/RankingCard";
import RankingHero from "../components/RankingHero";
import type { Work } from "@/types/work";

export default function RankingPage() {
  const [works, setWorks] = useState<Work[]>([]);

  async function loadWorks() {
    const { data } = await supabase
      .from("works")
      .select("*")
      .order("score", { ascending: false })
      .limit(30);

    setWorks(data || []);
  }

  useEffect(() => {
  void loadWorks();
}, []);

  return (
    <main className="min-h-screen bg-gray-100 p-8">
  <div className="max-w-7xl mx-auto">
  <p className="text-sm text-blue-600 font-semibold tracking-widest uppercase">
    発掘 LAB
  </p>

  <h1 className="mt-2 text-4xl font-extrabold">
    発掘ランキング
  </h1>

  <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
    発掘 LAB独自のスコアエンジンで分析した、
    今注目すべき作品をランキング形式で紹介しています。
  </p>

      {works.length >= 3 && <RankingHero works={works} />}

　<h2 className="mb-4 text-2xl font-bold">
  📊 4位〜30位ランキング
</h2>

　<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
       {works.slice(3).map((work, index) => (
  <div key={work.id} className="relative">
    

    <RankingCard
  work={work}
  rank={index + 4}
/>
  </div>
))}
</div>
</div>
    </main>
  );
}