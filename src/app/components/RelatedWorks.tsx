import WorkCard from "./WorkCard";
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
    <div className="mt-12">

      <h2 className="text-2xl font-bold mb-6">
  👩 {works[0]?.actress?.split(" / ")[0]} の人気作品
</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {works.map((work) => (
          <WorkCard
            key={work.id}
            work={work}
          />
        ))}

      </div>

    </div>
  );
}