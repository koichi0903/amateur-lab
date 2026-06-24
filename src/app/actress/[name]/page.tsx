import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default async function ActressDetailPage(
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const { data } = await supabase
    .from("works")
    .select("*")
    .ilike("actress", `%${decodeURIComponent(name)}%`)
    .order("score", { ascending: false });

    const workCount = data?.length || 0;

const averageScore =
  workCount > 0
    ? Math.round(
        (data || []).reduce(
          (sum, work) => sum + (work.score || 0),
          0
        ) / workCount
      )
    : 0;

const topImage =
  data?.[0]?.image_url || "";

const topWorks =
  data?.slice(0, 3) || [];

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">
        {decodeURIComponent(name)} の作品一覧
      </h1>
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-6 mb-8">
  {topImage && (
    <img
      src={topImage}
      alt={decodeURIComponent(name)}
      className="w-48 rounded-lg mb-4"
    />
  )}

  <h2 className="text-2xl font-bold">
    {decodeURIComponent(name)}
  </h2>

  <p className="mt-2">
    登録作品数: {workCount}件
  </p>

  <p>
    平均スコア: {averageScore}
  </p>
</div>

<div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
  <h2 className="text-2xl font-bold mb-4">
    🔥 高評価作品TOP3
  </h2>

  {topWorks.map((work, index) => (
    <div
      key={work.id}
      className="mb-3"
    >
      <Link href={`/works/${work.id}`}>
        <p className="font-bold text-blue-600 hover:underline">
          {index + 1}位 {work.title}
        </p>
      </Link>

      <p>
        発掘スコア: {work.score}
      </p>
    </div>
  ))}
</div>

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
  ジャンル: {
    work.genre
      ?.split(" / ")
      .slice(0, 4)
      .join(" / ")
  }
  {work.genre?.split(" / ").length > 4 && " ..."}
</p>
          <p>品番: {work.product_id}</p>
          <p>スコア: {work.score}</p>
        </div>
      ))}
    </main>
  );
}