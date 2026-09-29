import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
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

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-7 w-1 rounded-full bg-pink-500" aria-hidden="true" />
        <h2 className="text-2xl font-black text-zinc-900">関連作品</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {works.slice(0, 12).map((work) => <FanzaStyleWorkCard key={work.id} work={work} sourcePage="direct" showChart={false} />)}
      </div>
    </section>
  );
}
