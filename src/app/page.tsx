import { supabase } from "../lib/supabase";
import Link from "next/link";
import WorkCard from "./components/WorkCard";

export default async function Home() {
  const { data } = await supabase
    .from("works")
    .select("*")
    .order("score", { ascending: false });

  const { data: saleWorks } =
  await supabase
    .from("works")
    .select("*")
    .gt("discount_rate", 20)
    .order("discount_rate", {
      ascending: false,
    })
    .limit(4);

const { data: newWorks } =
  await supabase
    .from("works")
    .select("*")
    .order("release_date", {
      ascending: false,
    })
    .limit(4);
    
const actressStats: Record<
  string,
  {
    count: number;
    total: number;
    image: string;
  }
> = {};

data?.forEach((work) => {
  if (!work.actress) return;

  const actress =
    work.actress.split(" / ")[0];

  if (!actressStats[actress]) {
  actressStats[actress] = {
    count: 0,
    total: 0,
    image: work.image_url || "",
  };
}

  actressStats[actress].count++;
  actressStats[actress].total +=
    work.score || 0;
});

const topActresses = Object.entries(
  actressStats
)



  .map(([name, stats]) => ({
    name,
    count: stats.count,
    average: Math.round(
      stats.total / stats.count
    ),
    image: stats.image,
  }))
  .sort(
    (a, b) =>
      b.count - a.count
  )
  .slice(0, 5);

  const genreStats: Record<string, number> = {};

data?.forEach((work) => {
  if (!work.genre) return;

  work.genre.split(" / ").forEach((genre: string) => {
    if (!genreStats[genre]) {
      genreStats[genre] = 0;
    }

    genreStats[genre]++;
  });
});

const topGenres = Object.entries(
  genreStats
)
  .map(([name, count]) => ({
    name,
    count,
  }))
  .sort(
    (a, b) => b.count - a.count
  )
  .slice(0, 5);

  return (
<>

  <main className="min-h-screen bg-gray-100 p-8">
  <section className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold mb-4">
          素人発掘研究所
        </h1>

        <p className="text-lg mb-8">
          隠れた人気作品を発掘する作品分析メディア
        </p>

       <div className="flex gap-4 mb-8 flex-wrap">
  <Link
    href="/search"
    className="inline-block bg-black text-white px-4 py-2 rounded"
  >
    🔍 作品検索
  </Link>

  <Link
    href="/actress"
    className="inline-block bg-pink-600 text-white px-4 py-2 rounded"
  >
    🏆 女優ランキング
  </Link>

  <Link
    href="/genre"
    className="inline-block bg-blue-600 text-white px-4 py-2 rounded"
  >
    🏷️ ジャンルランキング
  </Link>

<Link
  href="/new"
  className="inline-block bg-green-600 text-white px-4 py-2 rounded"
>
  🆕 新着作品
</Link>

</div>

<div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
  <h2 className="text-2xl font-bold mb-4">
    🔥 今週の発掘作品
  </h2>

  {data?.[0] && (
  <WorkCard work={data[0]} large  />
)}

</div>
<div className="grid md:grid-cols-2 gap-6 mb-8 items-stretch">
<div className="bg-blue-50 border border-blue-200 rounded-xl p-6 h-full">
  <h2 className="text-2xl font-bold mb-4">
    🏷️ 人気ジャンルTOP5
  </h2>

  {topGenres.map((genre, index) => (
    <div
      key={genre.name}
      className="flex justify-between py-3 border-b"
    >
      <p className="font-bold text-blue-600">
        {index === 0 && "🥇 "}
        {index === 1 && "🥈 "}
        {index === 2 && "🥉 "}
        {index >= 3 && `${index + 1}位 `}
        {genre.name}
      </p>

      <p className="font-bold">
        {genre.count}件
      </p>
    </div>
  ))}

  <Link
    href="/genre"
    className="block text-center mt-4 bg-blue-600 text-white py-2 rounded-lg"
  >
    全ジャンルを見る →
  </Link>
</div>

<div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
  <h2 className="text-2xl font-bold mb-4">
    🏆 発掘女優TOP5
  </h2>

  {topActresses.map((actress, index) => (
    <div
      key={actress.name}
      className="flex gap-4 items-center mb-4 pb-4 border-b"
    >
      {actress.image && (
        <img
          src={actress.image}
          alt={actress.name}
          className="w-24 rounded-lg"
        />
      )}

      <div>
        <Link
          href={`/actress/${encodeURIComponent(
            actress.name
          )}`}
        >
          <p className="text-xl font-bold text-pink-600 hover:underline">
            {index === 0 && "🥇 "}
            {index === 1 && "🥈 "}
            {index === 2 && "🥉 "}
            {index >= 3 && `${index + 1}位 `}
            {actress.name}
          </p>
        </Link>

        <p>
          登録作品数: {actress.count}件
        </p>

        <p>
          平均スコア: {actress.average}
        </p>
      </div>
    </div>
  ))}
</div>
</div>


  <div className="rounded-xl bg-pink-50 border border-pink-200 p-6 shadow mb-8">
  <h2 className="text-2xl font-bold mb-4">
    🎁 今日のセール作品
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {saleWorks?.map((work) => (
      <WorkCard
        key={work.id}
        work={work}
      />
    ))}
  </div>
</div>

  <div className="rounded-xl bg-green-50 border border-green-200 p-6 shadow mb-8">
  <h2 className="text-2xl font-bold mb-4">
    🆕 新着作品
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {newWorks?.map((work) => (
      <WorkCard
        key={work.id}
        work={work}
      />
    ))}
  </div>

  <Link
    href="/new"
    className="block text-center mt-6 bg-green-600 text-white py-3 rounded-lg"
  >
    新着作品をもっと見る →
  </Link>
</div>

        <div className="rounded-xl bg-white p-6 shadow">
  <h2 className="text-2xl font-bold mb-4">
    📊 発掘ランキング
  </h2>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {data?.slice(0, 10).map((work) => (
    <WorkCard
      key={work.id}
      work={work}
    />
  ))}
</div>
         <Link
  href="/ranking"
  className="block text-center mt-6 bg-pink-600 text-white py-3 rounded-lg"
>
  発掘ランキングをもっと見る →
</Link>
</div>
      </section>
    </main>
  </>
);
}