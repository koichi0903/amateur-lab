import Link from "next/link";

type Props = {
  work: any;
  reasons: string[];
};

export default function WorkHero({
  work,
  reasons,
}: Props) {
  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-10 items-start">

      {/* 左カラム */}
      <div className="sticky top-6">

        {work.image_url && (
          <img
            src={work.image_url}
            alt={work.title}
            className="w-full max-w-[320px] rounded-xl shadow-lg"
          />
        )}

      </div>

      {/* 右カラム */}
      <div>

        <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight tracking-tight">
          {work.title}
        </h1>

        <div className="mt-5 bg-white rounded-xl border p-6 shadow-sm">

          <div className="grid grid-cols-2 gap-6">

            <div>
  <p className="text-xs text-gray-500">👩 女優</p>

  <div className="flex flex-wrap gap-2 mt-1">
    {work.actress?.split(" / ").map((actress: string) => (
      <Link
        key={actress}
        href={`/actress/${encodeURIComponent(actress)}`}
        className="font-bold text-blue-600 hover:underline"
      >
        {actress}
      </Link>
    ))}
  </div>
</div>

            <div>
              <p className="text-xs text-gray-500">🏷 ジャンル</p>
             <div className="flex flex-wrap gap-2 mt-1">
  {work.genre?.split(" / ").map((genre: string) => (
    <Link
      key={genre}
      href={`/genre/${encodeURIComponent(genre)}`}
      className="font-bold text-blue-600 hover:underline"
    >
      {genre}
    </Link>
  ))}
</div>
</div>

            <div>
  <p className="text-xs text-gray-500">🏢 メーカー</p>
 {work.maker ? (
  <Link
    href={`/maker/${encodeURIComponent(work.maker)}`}
    className="font-bold text-blue-600 hover:underline"
  >
    {work.maker}
  </Link>
) : (
  <p className="font-bold">-</p>
)}
</div>

<div>
  <p className="text-xs text-gray-500">📚 シリーズ</p>
  {work.series ? (
  <Link
    href={`/series/${encodeURIComponent(work.series)}`}
    className="font-bold text-blue-600 hover:underline"
  >
    {work.series}
  </Link>
) : (
  <p className="font-bold">-</p>
)}
</div>

            {work.review_average > 0 && (
              <div>
                <p className="text-xs text-gray-500">⭐ レビュー</p>
                <p className="font-bold">
                  {work.review_average}
                  {work.review_count > 0 &&
                    `（${work.review_count}件）`}
                </p>
              </div>
            )}

            {work.discount_rate > 0 && (
              <div>
                <p className="text-xs text-gray-500">🔥 セール</p>
                <p className="font-bold text-red-600">
                  {work.discount_rate}%OFF
                </p>
              </div>
            )}

          </div>

          <hr className="my-6 border-gray-200" />

          {work.sale_price > 0 && (
            <div className="mt-5 flex items-end gap-3">

  <span className="text-2xl text-gray-400 line-through">
    ¥{work.price?.toLocaleString()}
  </span>

  <span className="text-3xl font-bold text-gray-500 mx-3">
  →
</span>

  <span className="text-5xl font-black text-red-600">
    ¥{work.sale_price.toLocaleString()}
  </span>

</div>
          )}

        </div>

                {work.affiliate_url && (
          <a
            href={work.affiliate_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex justify-center items-center w-full bg-pink-600 hover:bg-pink-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg"
          >
            🩷 FANZAで作品を見る
          </a>
        )}

        {work.score >= 60 && (
          <div className="bg-indigo-600 text-white rounded-xl p-4 mt-6 text-center shadow">

            <p className="text-7xl font-black leading-none">
              {work.score}
            </p>

            <p className="mt-3 font-bold">
              {work.score >= 95
                ? "👑 SSランク"
                : work.score >= 90
                ? "🏆 Sランク"
                : work.score >= 80
                ? "⭐ Aランク"
                : work.score >= 70
                ? "👍 Bランク"
                : "📈 注目作品"}
            </p>

            <p className="mt-2 text-indigo-100">
              人気・評価・価格・セールをAI分析
            </p>

            {reasons.length > 0 && (
              <div className="mt-5 border-t border-indigo-400 pt-4">

                <p className="text-sm font-semibold mb-3 text-indigo-100">
                  この作品をおすすめする理由
                </p>

                <div className="flex flex-wrap justify-center gap-2">

                  {reasons.map((reason) => (
                    <span
                      key={reason}
                      className="bg-white text-indigo-700 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap"
                    >
                      {reason}
                    </span>
                  ))}

                </div>

              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}