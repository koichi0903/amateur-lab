import Link from "next/link";
import Image from "next/image";
import type { Work } from "@/types/work";

export type FeaturedWork = Pick<
  Work,
  | "id"
  | "title"
  | "actress"
  | "image_url"
  | "score"
  | "review_average"
  | "review_count"
  | "price"
  | "sale_price"
>;

type Props = {
  work: FeaturedWork;
};

export default function FeaturedWorkCard({
  work,
}: Props) {
  const actress =
    work.actress?.split(" / ")[0] ?? "";

  const currentPrice =
    work.sale_price && work.sale_price > 0
      ? work.sale_price
      : work.price;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">

      <div className="flex gap-4">

        <div className="shrink-0">

          {work.image_url && (
  <Image
    src={work.image_url}
    alt={work.title}
    width={110}
    height={150}
    className="rounded-lg"
  />
)}

          <div className="mt-3 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 py-2 text-center text-sm font-bold text-white">
            発掘 {work.score}
          </div>

        </div>

        <div className="flex flex-1 flex-col">

          <Link
            href={`/works/${work.id}`}
            className="font-bold leading-6 text-blue-700 hover:underline"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {work.title}
          </Link>

          <div className="mt-3 text-sm text-zinc-600">
            👩 {actress}
          </div>

          {work.review_average > 0 && (
            <div className="mt-1 text-sm text-yellow-600 font-semibold">
              ⭐ {work.review_average}
              <span className="ml-1 text-zinc-500">
                ({work.review_count}件)
              </span>
            </div>
          )}

          <div className="mt-auto">

            {work.sale_price > 0 &&
              work.sale_price < work.price && (
                <div className="mt-4 text-sm text-zinc-400 line-through">
                  ¥{work.price.toLocaleString()}
                </div>
              )}

            <div className="text-3xl font-black text-red-600">
              ¥{currentPrice.toLocaleString()}
            </div>

            <Link
              href={`/works/${work.id}`}
              className="mt-4 inline-flex rounded-xl bg-pink-600 px-5 py-2 font-bold text-white transition hover:bg-pink-700"
            >
              詳細を見る →
            </Link>

          </div>

        </div>

      </div>

    </article>
  );
}
