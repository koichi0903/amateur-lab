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

      <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">

        {works.map((work) => (
  <div
    key={work.id}
    className="w-[min(360px,calc(100vw-5rem))] flex-shrink-0 snap-start sm:w-[360px]"
  >
    <FeaturedWorkCard work={work} />
  </div>
))}
      </div>

    </section>
  );
}
