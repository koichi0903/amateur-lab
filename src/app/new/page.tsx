import { supabase } from "../lib/supabase";
import Link from "next/link";

export default async function NewPage() {
  const { data } = await supabase
    .from("works")
    .select("*")
    .order("id", { ascending: false });

  return (
    <main className="min-h-screen p-8">
      
      <h1 className="text-3xl font-bold mb-6">
        🆕 新着作品
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data?.map((work) => (
          <div
            key={work.id}
            className="bg-white rounded-xl shadow p-4"
          >
            {work.image_url && (
              <img
                src={work.image_url}
                alt={work.title}
                className="w-48 rounded mb-3"
              />
            )}

            <Link href={`/works/${work.id}`}>
              <p className="font-bold text-blue-600 hover:underline">
                {work.title}
              </p>
            </Link>

            <p>
  女優: {
    work.actress
      ?.split(" / ")
      .slice(0, 6)
      .join(" / ")
  }
  {work.actress?.split(" / ").length > 6 && " ..."}
</p>
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