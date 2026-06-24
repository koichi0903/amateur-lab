import { supabase } from "../lib/supabase";
import Link from "next/link";

export default async function GenrePage() {
  const { data } = await supabase
    .from("works")
    .select("genre");

  const genreCount: Record<string, number> = {};

  data?.forEach((work) => {
    if (!work.genre) return;

    work.genre
      .split(" / ")
      .forEach((name: string) => {
        genreCount[name] =
          (genreCount[name] || 0) + 1;
      });
  });

  const ranking = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1]);

  return (
    <main className="min-h-screen p-8">
      
      <h1 className="text-3xl font-bold mb-6">
        🏷️ ジャンルランキング
      </h1>

      {ranking.map(([name, count], index) => (
        <div
          key={name}
          className="border p-4 mb-2 rounded"
        >
          <Link
            href={`/genre/${encodeURIComponent(name)}`}
          >
            <p className="font-bold text-blue-600 hover:underline">
              {index + 1}位 {name}
            </p>
          </Link>

          <p>
            登録作品数: {count}
          </p>
        </div>
      ))}
    </main>
  );
}