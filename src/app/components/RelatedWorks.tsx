import FeaturedWorkCard from "./FeaturedWorkCard";
import type { Work } from "@/types/work";

type Props = {
  works: Work[] | null;
};

export default function RelatedWorks({
  works,
}: Props) {
  if (!works || works.length === 0) {
    return null;
  }

  const actress =
    works[0]?.actress?.split(" / ")[0] ?? "";

  return (
    <section className="mt-12">

      <div className="mb-6 flex items-center justify-between">

        <div>

          <h2 className="text-3xl font-black text-zinc-900">
            👩 関連作品
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {actress} のおすすめ作品
          </p>

        </div>

        <div className="rounded-full bg-pink-100 px-4 py-2 text-sm font-bold text-pink-700">
          全{works.length}作品
        </div>

      </div>

      <div className="mb-3 flex items-center justify-end gap-1 text-xs font-bold text-pink-600 sm:hidden">
        <span aria-hidden="true">←</span>
        横にスワイプして続きを見る
        <span aria-hidden="true">→</span>
      </div>

      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-4 snap-x snap-mandatory scrollbar-thin sm:mx-0 sm:gap-6 sm:px-0">

        {works.map((work) => (
  <div
    key={work.id}
    className="w-[82%] max-w-[18rem] flex-shrink-0 snap-start sm:w-[360px] sm:max-w-none"
  >
    <FeaturedWorkCard work={work} />
  </div>
))}
      </div>

    </section>
  );
}
