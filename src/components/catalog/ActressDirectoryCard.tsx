import Link from "next/link";
import { ArrowRight } from "lucide-react";
import WorkImage from "@/components/home/WorkImage";
import type { ActressProfile } from "@/lib/catalog/actressProfiles";
import { buildActressDirectoryProfileDetails } from "@/lib/catalog/actressDirectory";
import type { EntityIndexSummary } from "@/lib/catalog/entityIndexSummaries";

type Props = {
  item: EntityIndexSummary;
  profile?: ActressProfile;
};

export default function ActressDirectoryCard({ item, profile }: Props) {
  const profileImage = profile?.image_url_large || profile?.image_url_small || null;
  const profileDetails = buildActressDirectoryProfileDetails(profile);

  return (
    <Link href={`/actress/${encodeURIComponent(item.name)}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg sm:p-3">
      <div className="relative flex items-center justify-center">
        <div className="relative h-28 w-28 overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-sm">
          <WorkImage src={profileImage || item.imageUrl} fallbackSrc={profileImage ? item.imageUrl : null} alt={`${item.name}のプロフィール画像`} sizes="112px" unoptimized className="object-cover object-[50%_25%] transition duration-300 group-hover:scale-105" />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-1.5">
        <h2 className="mt-0.5 truncate text-base font-black sm:text-lg">{item.name}</h2>
        <div className="mt-1 h-[4rem] space-y-0.5 overflow-hidden text-xs font-bold leading-4 text-slate-500">
          {profileDetails.map((detail) => <p key={detail}>{detail}</p>)}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
          <div><p className="text-[10px] font-bold text-slate-400">登録作品数</p><p className="text-xl font-black text-pink-600">{item.count}<span className="ml-0.5 text-xs">作品</span></p></div>
          <ArrowRight size={17} className="mb-1 text-pink-600" />
        </div>
      </div>
    </Link>
  );
}
