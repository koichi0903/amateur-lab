import Link from "next/link";

type Props = {
  work: any;
  large?: boolean;
};

export default function WorkCard({
  work,
  large = false,
}: Props) {
  return (
    <div
      className="border rounded-xl p-5 shadow hover:shadow-lg transition flex gap-5"
    >
      <div
  className={`flex flex-col items-center self-start ${
    large ? "w-[220px]" : "w-[170px]"
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
      className="font-bold text-xl text-blue-600 hover:underline leading-7"
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

  <div className="grid grid-cols-[1.2fr_1fr_auto] gap-x-6">

    {/* 左列 */}
    <div className="space-y-3">

      <p>
        👩 {work.actress?.split(" / ")[0]}
      </p>

      <p className="text-sm text-gray-500">
        🏷️ {
          work.genre
            ?.split(" / ")
            .slice(0,3)
            .join(" ・ ")
        }
      </p>

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
        className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-bold whitespace-nowrap"
      >
        詳細 →
      </Link>

    </div>

  </div>

</div>

        </div>
  );
}