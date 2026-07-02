import Link from "next/link";
import type { Work } from "@/types/work";
import ScoreBar from "./ScoreBar";

type Props = {
  work: Work;
  rank?: number;
  large?: boolean;
};

export default function RankingCard({
  work,
  rank,
  large = false,
}: Props) {

  const MiniBar = ({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) => (
  <div className="flex items-center gap-2">

    <span className="w-16 text-[11px] text-gray-600 font-medium">
  {label}
</span>

    <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">

      <div
        className="h-full rounded-full bg-indigo-600"
        style={{
          width: `${Math.min((value / max) * 100, 100)}%`,
        }}
      />

    </div>

    <span className="w-5 text-right text-[11px] font-bold text-gray-700">
      {value}
    </span>

  </div>
);

const reasons: string[] = [];

if ((work.ranking_score ?? 0) >= 18) {
  reasons.push("🏆 FANZAランキング上位");
}

if ((work.actress_point ?? 0) >= 18) {
  reasons.push("👩 人気女優出演");
}

if ((work.review_score ?? 0) >= 14) {
  reasons.push("⭐ 高評価作品");
}

if ((work.discount_score ?? 0) >= 5) {
  reasons.push("💰 セール対象");
}

if ((work.new_release_score ?? 0) >= 8) {
  reasons.push("🆕 新作");
}

  return (
  <div
  className="relative border rounded-xl p-5 shadow hover:shadow-lg transition flex flex-col lg:flex-row gap-5"
>
      {rank && (
  <div className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold shadow-lg">
    {rank}
  </div>
)}

      <div
  className={`flex flex-col items-center self-start ${
    large ? "w-[320px]" : "w-[170px]"
  }`}
 >

  {work.image_url && (
    <img
      src={work.image_url}
      alt={work.title}
      className={`object-contain rounded-lg bg-white ${
  large
    ? "w-[220px] h-[170px]"
    : "w-[170px] h-[130px]"
}`}
    />
  )}

  {work.score > 0 && (
  <span className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-full font-bold text-base">
    発掘スコア {work.score}
  </span>
)}

</div>

<div className="flex-1 flex flex-col">

  <Link
    href={`/works/${work.id}`}
    className="block mb-4"
  >
    <h2
      className="font-bold text-lg lg:text-xl text-blue-600 hover:underline leading-7"
      style={{
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {work.title}
    </h2>
  </Link>

  <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_150px] gap-6">

    {/* 左列 */}
    <div className="space-y-3">

      <div className="flex flex-wrap gap-2">
  <Link
    href={`/actress/${encodeURIComponent(
      work.actress?.split(" / ")[0] || ""
    )}`}
    className="text-blue-600 hover:underline"
  >
    👩 {work.actress?.split(" / ")[0]}
  </Link>
</div>

      <div className="flex flex-wrap gap-2 text-sm">
  {work.genre
    ?.split(" / ")
    .slice(0, 3)
    .map((genre: string) => (
      <Link
        key={genre}
        href={`/genre/${encodeURIComponent(genre)}`}
        className="text-blue-600 hover:underline"
      >
        🏷️ {genre}
      </Link>
    ))}
</div>

      {work.sale_price > 0 &&
      work.sale_price < work.price ? (
        <>
          <p className="text-gray-400 line-through">
            ¥{work.price.toLocaleString()}
          </p>

          <p className="text-3xl font-bold text-red-600">
            ¥{work.sale_price.toLocaleString()}
          </p>
        </>
      ) : (
        <p className="text-3xl font-bold">
          ¥{work.price.toLocaleString()}
        </p>
      )}

    </div>

    {/* 中央列 */}
    <div className="space-y-3">

      {work.review_average > 0 && (
        <p className="font-bold text-yellow-600">
          ⭐ {work.review_average}
          <span className="text-gray-500 ml-1">
            ({work.review_count}件)
          </span>
        </p>
      )}

      <p className="text-sm text-gray-500">
        品番：{work.product_id}
      </p>

      <div className="flex flex-col gap-2 items-start">

        {reasons.length > 0 && (
  <div className="hidden lg:block mt-3 rounded-lg bg-blue-50 p-3 w-full">
    <p className="text-xs font-bold text-blue-700 mb-2">
      この作品のおすすめ理由
    </p>

    <div className="flex flex-col gap-1">
      {reasons.map((reason) => (
        <span
          key={reason}
          className="text-xs text-gray-700"
        >
          {reason}
        </span>
      ))}
    </div>
  </div>
)}

        {work.score >= 95 && (
          <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
            🔥急上昇
          </span>
        )}

        {work.score >= 90 &&
          work.score < 95 && (
          <span className="bg-yellow-500 text-white px-2 py-1 rounded-full text-xs">
            ⭐人気
          </span>
        )}

        {work.discount_rate > 0 && (
          <span className="bg-pink-600 text-white px-2 py-1 rounded-full text-xs">
            🔥{work.discount_rate}%OFF
          </span>
        )}

      </div>

    </div>

    {/* 右列 */}
    <div className="flex flex-col justify-between items-end">

      <Link
        href={`/works/${work.id}`}
        className="w-full lg:w-auto text-center bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-bold"
      >
        詳細 →
      </Link>

    {/* デバッグ用（後で消す） */}

<div className="hidden lg:block mt-3 w-full border-t pt-3 space-y-2">

  <MiniBar
  label="👩 女優"
  value={work.actress_point ?? 0}
  max={20}
/>

<MiniBar
  label="⭐ レビュー"
  value={work.review_score ?? 0}
  max={15}
/>

<MiniBar
  label="🏆 人気度"
  value={work.ranking_score ?? 0}
  max={20}
/>

<MiniBar
  label="💰 割引"
  value={work.discount_score ?? 0}
  max={5}
/>

<MiniBar
  label="🆕 新作"
  value={work.new_release_score ?? 0}
  max={10}
/>

</div>

    </div>

  </div>

</div>

        </div>
  );
}