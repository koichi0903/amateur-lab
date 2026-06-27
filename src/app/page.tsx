import { supabase } from "./lib/supabase";
import Link from "next/link";

export default async function Home() {
  const { data } = await supabase
    .from("works")
    .select("*")
    .order("score", { ascending: false });
    
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
      <section className="mx-auto max-w-4xl">
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
    <Link href={`/works/${data[0].id}`}>
      <div className="flex gap-4 items-center cursor-pointer">
        {data[0].image_url && (
          <img
            src={data[0].image_url}
            alt={data[0].title}
            className="w-40 rounded-lg"
          />
        )}

        <div>

          <p className="text-xl font-bold text-blue-600">
            {data[0].title}
          </p>

          <p className="mt-2">
            発掘スコア: {data[0].score}
          </p>

          <p className="mt-2">
            🔥 今もっとも注目されている作品
          </p>
        </div>
      </div>
    </Link>
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



        <div className="rounded-xl bg-white p-6 shadow">
  <h2 className="text-2xl font-bold mb-4">
    📊 発掘ランキング
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {data?.slice(0, 10).map((work, index) => (
      <div
        key={work.id}
        className="bg-white rounded-xl shadow p-4"
      >
             {work.image_url && (
  <Link href={`/works/${work.id}`}>
    <img
      src={work.image_url}
      alt={work.title}
      className="w-48 rounded-lg mb-3 cursor-pointer"
    />
  </Link>
)}
              <Link href={`/works/${work.id}`}>
  <p className="font-bold text-blue-600 hover:underline">
    {index + 1}位 {work.title}
  </p>
</Link>

              <p>
  ジャンル: {
    work.genre
      ?.split(" / ")
      .slice(0, 4)
      .join(" / ")
  }

  {work.genre?.split(" / ").length > 4 &&
    " ..."}
</p>

  <p>
  女優: {
    work.actress
      ?.split(" / ")
      .slice(0, 6)
      .join(" / ")
  }

  {work.actress?.split(" / ").length > 6 &&
    " ..."}
</p>

<p>品番: {work.product_id}</p>

              <div className="mt-2">
  {work.score >= 95 && (
    <span className="bg-red-500 text-white px-2 py-1 rounded text-sm mr-2">
      🔥 急上昇
    </span>
  )}

  {work.score >= 90 && work.score < 95 && (
    <span className="bg-yellow-500 text-white px-2 py-1 rounded text-sm mr-2">
      ⭐ 人気
    </span>
  )}

  {work.score >= 80 && work.score < 90 && (
    <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm mr-2">
      📌 注目
    </span>
  )}

  {work.review_average > 0 && (
  <p className="text-sm text-yellow-600 font-bold mt-2">
    ⭐ {work.review_average}
    {work.review_count > 0 &&
      `（${work.review_count}件）`}
  </p>
)}

{work.discount_rate > 0 && (
  <p className="text-sm text-red-600 font-bold">
    🔥 {work.discount_rate}%OFF
  </p>
)}

{work.price > 0 && (
  <div className="mt-2">
    {work.sale_price > 0 &&
    work.sale_price < work.price ? (
      <>
        <p className="text-gray-500 line-through">
          通常価格 ¥{work.price.toLocaleString()}
        </p>

        <p className="text-red-600 font-bold text-lg">
          セール ¥{work.sale_price.toLocaleString()}
        </p>
      </>
    ) : (
      <p className="font-bold">
        ¥{work.price.toLocaleString()}
      </p>
    )}
  </div>
)}

  {work.score >= 60 && (
  <p className="mt-2">
    発掘スコア: {work.score}
  </p>
)}
</div>

            </div>
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