import { supabase } from "../lib/supabase";
import Link from "next/link";
import WorkCard from "./components/WorkCard";
import Image from "next/image";
import TopRankingCard from "./components/TopRankingCard";
import type { Work } from "@/types/work";
import { getAllWorks } from "@/lib/getAllWorks";
import SiteStatistics from "./components/SiteStatistics";
import { getSiteStatistics } from "@/lib/getSiteStatistics";
import CollectionPageJsonLd from "./components/CollectionPageJsonLd";

export default async function Home() {
  const data = await getAllWorks();

  const statistics = await getSiteStatistics();

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

  work.actress
    .split(" / ")
    .forEach((actress: string) => {
      if (!actressStats[actress]) {
        actressStats[actress] = {
          count: 0,
          total: 0,
          image: work.image_url || "",
        };
      }

      actressStats[actress].count++;
      actressStats[actress].total += work.score || 0;
    });
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

  const makerStats: Record<string, number> = {};

data?.forEach((work) => {
  if (!work.maker) return;

  makerStats[work.maker] =
    (makerStats[work.maker] || 0) + 1;
});

const seriesStats: Record<string, number> = {};

data?.forEach((work) => {
  if (!work.series) return;

  seriesStats[work.series] =
    (seriesStats[work.series] || 0) + 1;
});

const topSeries = Object.entries(seriesStats)
  .map(([name, count]) => ({
    name,
    count,
  }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 5);

const topMakers = Object.entries(makerStats)
  .map(([name, count]) => ({
    name,
    count,
  }))
  .sort((a, b) => b.count - a.count)
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
    <CollectionPageJsonLd
      title="発掘LAB"
      description="FANZA作品を独自アルゴリズムで分析するレビュー・ランキングメディア"
      url="https://amateur-lab.vercel.app/"
    />

  <main className="min-h-screen bg-gray-100 p-8">
  <section className="mx-auto max-w-7xl">
       <h1 className="text-5xl font-black tracking-tight mb-3">
  🔬 発掘LAB
</h1>

<p className="text-2xl font-semibold text-pink-600 mb-4">
  FANZA作品分析メディア
</p>

<p className="text-lg text-gray-600 leading-8 max-w-3xl mb-8">
  FANZA作品をレビュー・人気女優・ランキング・セール情報から独自分析。
  毎日更新される発掘スコアで、
  「今、本当におすすめできる作品」を見つける分析メディアです。
</p>

<div className="flex flex-wrap gap-3 mb-8">

  <span className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-full">
    📊 独自スコア分析
  </span>

  <span className="bg-pink-100 text-pink-700 px-3 py-2 rounded-full">
    🏆 FANZAランキング連動
  </span>

  <span className="bg-green-100 text-green-700 px-3 py-2 rounded-full">
    🆕 毎日データ更新
  </span>

  <span className="bg-yellow-100 text-yellow-700 px-3 py-2 rounded-full">
    🔥 セール情報
  </span>

</div>

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

<SiteStatistics
  totalWorks={statistics.total_works}
  totalActresses={statistics.total_actresses}
  totalMakers={statistics.total_makers}
  totalSeries={statistics.total_series}
  totalGenres={statistics.total_genres}
  lastUpdatedAt={statistics.last_updated_at}
/>

<div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
  <h2 className="text-2xl font-bold mb-4">
    🔥 今週の発掘作品
  </h2>

  {data?.[0] && (
  <WorkCard work={data[0]} large  />
)}
</div>

<div className="grid md:grid-cols-[55%_45%] gap-6 mb-8 items-start">

     {/* 左 */}
  <div>

<div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
  <h2 className="text-2xl font-bold mb-4">
    🏆 人気女優TOP5
  </h2>

  {topActresses.map((actress, index) => (
    <div
      key={actress.name}
      className="flex gap-4 items-center mb-4 pb-4 border-b"
    >
      {actress.image && (
        <Image
  src={actress.image}
  alt={actress.name}
  width={110}
height={155}
  className="w-24 rounded-lg object-cover"
/>


      )}

      <div>
        <Link
          href={`/actress/${encodeURIComponent(
            actress.name
          )}`}
        >
          <p className="text-2xl font-bold text-pink-600 hover:underline">
            {index === 0 && "🥇 "}
            {index === 1 && "🥈 "}
            {index === 2 && "🥉 "}
            {index >= 3 && `${index + 1}位 `}
            {actress.name}
          </p>
        </Link>

        <div className="mt-2 space-y-1 text-sm">

  <p className="flex items-center text-sm">
  <span className="mr-2">📀</span>

  <span className="w-24">
    登録作品
  </span>

  <span className="font-bold">
    {actress.count}作品
  </span>
</p>

<p className="mt-1 flex items-center text-sm">
  <span className="mr-2">⭐</span>

  <span className="w-24">
    平均スコア
  </span>

  <span className="font-bold text-pink-600">
    {actress.average}点
  </span>
</p>

</div>
      </div>
    </div>
  ))}
  <Link
  href="/actress"
  className="mt-4 block rounded-lg bg-pink-600 py-2 text-center text-sm font-bold text-white hover:bg-pink-700"
>
  全女優を見る →
</Link>
</div>
</div>

  {/* 右 */}
  <div className="flex flex-col gap-6">

<TopRankingCard
  title="人気ジャンルTOP3"
  icon="🏷️"
  items={topGenres}
  href="/genre"
/>

<TopRankingCard
      title="人気メーカーTOP3"
      icon="🏭"
      items={topMakers}
      href="/maker"
    />

    <TopRankingCard
      title="人気シリーズTOP3"
      icon="📚"
      items={topSeries}
      href="/series"
    />

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