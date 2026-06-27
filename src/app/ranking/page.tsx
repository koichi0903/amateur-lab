"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import WorkCard from "../components/WorkCard";

export default function RankingPage() {
  const [works, setWorks] = useState<any[]>([]);

  useEffect(() => {
    loadWorks();
  }, []);

  async function loadWorks() {
    const { data } = await supabase
      .from("works")
      .select("*")
      .order("score", { ascending: false })
      .limit(30);

    setWorks(data || []);
  }

  return (
    <main className="min-h-screen p-8">

      <h1 className="text-3xl font-bold mb-8">
        発掘ランキング
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {works.map((work) => (
  <WorkCard
    key={work.id}
    work={work}
  />
))}
      </div>

    </main>
  );
}