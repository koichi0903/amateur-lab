import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import WorkCard from "../../components/WorkCard";

export default async function MakerDetailPage(
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const { data } = await supabase
    .from("works")
    .select("*")
    .ilike(
  "maker",
  decodeURIComponent(name)
)
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

    const averageReview =
  workCount > 0
    ? (
        (data || []).reduce(
          (sum, work) => sum + (work.review_average || 0),
          0
        ) / workCount
      ).toFixed(2)
    : "0.00";

    const comments: string[] = [];

if (averageScore >= 90) {
  comments.push("発掘LABでも最高クラスの評価を獲得しています。");
} else if (averageScore >= 80) {
  comments.push("発掘LABで高評価作品が非常に多い女優です。");
}

if (Number(averageReview) >= 4.5) {
  comments.push("レビュー評価も高く、満足度の高い作品が多くあります。");
}

if (workCount >= 30) {
  comments.push("出演作品数も豊富なので、初めて見る方にもおすすめです。");
}

const topImage =
  data?.[0]?.image_url || "";

const topWorks =
  data?.slice(0, 3) || [];

  return (
    <main className="min-h-screen bg-gray-100 p-8">
  <div className="max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-[220px_1fr] gap-8 mb-8">

  <div>
    {topImage && (
      <img
        src={topImage}
        alt={decodeURIComponent(name)}
        className="w-full rounded-xl shadow-lg"
      />
    )}
  </div>

  <div>


    <h1 className="text-4xl font-extrabold">
     🏢️ {decodeURIComponent(name)}
    </h1>

    <div className="mt-6 bg-white rounded-xl border p-6 shadow-sm">

      <div className="grid grid-cols-2 gap-6">

        <div>
          <p className="text-xs text-gray-500">
            📀 登録作品
          </p>

          <p className="text-2xl font-bold">
            {workCount}作品
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            🏆 平均スコア
          </p>

          <p className="text-2xl font-bold text-indigo-600">
            {averageScore}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            ⭐ 平均レビュー
          </p>

          <p className="text-2xl font-bold text-yellow-500">
            {averageReview}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            👑 最高スコア
          </p>

          <p className="text-2xl font-bold text-red-500">
            {topWorks[0]?.score ?? "-"}
          </p>
        </div>

      </div>

    </div>

  </div>

</div>

<div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mb-8">
  <h2 className="text-2xl font-bold mb-4">
    🤖 AI分析
  </h2>

  <p className="text-gray-700 mb-4">
    {decodeURIComponent(name)}は、
発掘LABに登録されているメーカー作品を分析した結果、
    平均スコア<strong>{averageScore}</strong>点、
    平均レビュー<strong>{averageReview}</strong>点を獲得しています。
  </p>

  <ul className="space-y-2">
    {comments.map((comment) => (
      <li
        key={comment}
        className="bg-white rounded-lg p-3 border"
      >
        ✅ {comment}
      </li>
    ))}
  </ul>
</div>

<div className="mb-10">
  <h2 className="text-2xl font-bold mb-6">
    🔥 高評価作品TOP3
  </h2>

  <div className="space-y-6">
    {topWorks.map((work) => (
      <WorkCard
        key={work.id}
        work={work}
      />
    ))}
  </div>
</div>

<h2 className="text-2xl font-bold mt-12 mb-6">
  📚 全作品一覧
</h2>

    <div className="space-y-6">
 {data?.slice(3).map((work) => (
  <WorkCard
    key={work.id}
    work={work}
  />
))}
</div>
</div>
    </main>
  );
}