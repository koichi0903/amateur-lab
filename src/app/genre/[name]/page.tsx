import { supabase } from "../../../lib/supabase";
import Link from "next/link";

export default async function GenreDetailPage(
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const { data } = await supabase
    .from("works")
    .select("*")
    .ilike("genre", `%${decodeURIComponent(name)}%`)
    .order("score", { ascending: false });

  return (
    <main className="min-h-screen p-8">
      <Link
  href="/genre"
  className="text-blue-600 hover:underline"
>
  ← ジャンルランキングへ戻る
</Link>
      <h1 className="text-3xl font-bold mb-6">
        {decodeURIComponent(name)} の作品一覧
      </h1>

      {data?.map((work) => (
        <div
          key={work.id}
          className="border p-4 mb-3 rounded"
        >
          {work.image_url && (
            <img
              src={work.image_url}
              alt={work.title}
              className="w-40 rounded mb-2"
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
          <p>品番: {work.product_id}</p>
          <p>スコア: {work.score}</p>
        </div>
      ))}
    </main>
  );
}