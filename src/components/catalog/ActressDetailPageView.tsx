import Link from "next/link";
import { ArrowLeft, CalendarDays, Ruler, Shapes } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import type { Work } from "@/types/work";
import type { HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import { getActressProfiles } from "@/lib/catalog/actressProfiles";

type ActressProfile = Awaited<ReturnType<typeof getActressProfiles>>[number];

type Props = {
  actressName: string;
  currentPage: number;
  hasPageError: boolean;
  works: Work[];
  profile: ActressProfile | undefined;
  totalCount: number;
  totalPages: number;
  topWork: Work | undefined;
  highCostWorks: Work[];
  newestWorks: Work[];
  insightCandidatesCount: number;
  priceInsightsByWorkId: Map<number, HomePriceInsightWork>;
  worksWithMultiDayPriceHistory: number;
  pageHref: (targetPage: number) => string;
};

function SectionTitle({ title, count, color }: { title: string; count?: number; color: "amber" | "pink" }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={`h-7 w-1 rounded-full ${color === "amber" ? "bg-amber-400" : "bg-pink-500"}`} />
      <h2 className="text-xl font-black">{title}</h2>
      {count != null && <span className="text-xs font-bold text-zinc-500">({count}件)</span>}
    </div>
  );
}

function ActressBirthdayFact({ profile }: { profile: ActressProfile | undefined }) {
  return (
    <p className="flex items-center gap-2 text-slate-500"><CalendarDays size={15} /> 生年月日 <strong className="text-slate-800">{profile?.birthday ?? "未取得"}</strong></p>
  );
}

function ActressHeightFact({ profile }: { profile: ActressProfile | undefined }) {
  return (
    <p className="flex items-center gap-2 text-slate-500"><Ruler size={15} /> 身長 <strong className="text-slate-800">{profile?.height_cm ? `${profile.height_cm} cm` : "未取得"}</strong></p>
  );
}

function ActressMeasurementsFact({ profile }: { profile: ActressProfile | undefined }) {
  const measurementText = profile?.bust_cm || profile?.waist_cm || profile?.hip_cm
    ? `B${profile.bust_cm ?? "-"} / W${profile.waist_cm ?? "-"} / H${profile.hip_cm ?? "-"}`
    : "未取得";
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500"><Shapes size={15} /> スリーサイズ <strong className="text-slate-800">{measurementText}</strong></p>
  );
}

function ActressProfileFacts({ profile }: { profile: ActressProfile | undefined }) {
  return (
    <div className="space-y-2 text-sm">
      <ActressBirthdayFact profile={profile} />
      <ActressHeightFact profile={profile} />
      <ActressMeasurementsFact profile={profile} />
    </div>
  );
}

function ActressProfileCard({
  actressName,
  profile,
  topWork,
  totalCount,
}: Pick<Props, "actressName" | "profile" | "topWork" | "totalCount">) {
  const profileImage = profile?.image_url_large || profile?.image_url_small || null;
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-pink-600 bg-slate-100 sm:h-32 sm:w-32">
          <WorkImage src={profileImage || topWork?.image_url} fallbackSrc={profileImage ? topWork?.image_url : null} alt={`${actressName}のプロフィール写真`} sizes="128px" unoptimized className="object-cover" />
        </div>
        <div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-3 sm:items-center">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">{actressName}の出演作品・プロフィール</h1>
            {profile?.ruby && <p className="mt-1 text-sm text-slate-500">{profile.ruby}</p>}
          </div>
          <ActressProfileFacts profile={profile} />
        </div>
      </div>
      <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">出演作品は全{totalCount.toLocaleString("ja-JP")}作品。新着作品や価格・レビュー情報を見ながら、作品を比較できます。</p>
    </section>
  );
}

function PriceHistoryNotice({
  insightCandidatesCount,
  worksWithMultiDayPriceHistory,
}: Pick<Props, "insightCandidatesCount" | "worksWithMultiDayPriceHistory">) {
  if (worksWithMultiDayPriceHistory === 0) return null;
  return (
    <p className="mt-3 rounded-lg bg-pink-50 px-4 py-3 text-sm leading-6 text-slate-700">
      高コスパ作品とこのページの作品一覧（最大{insightCandidatesCount}作品）のうち、各作品の初期表示の販売形式・配信期間で90日以内に異なる2日以上の価格記録を比べられる作品は<strong className="text-pink-700"> {worksWithMultiDayPriceHistory}作品</strong>です。記録のない期間の価格は分かりません。
    </p>
  );
}

function ActressWorkSection({
  title,
  color,
  works,
  gridClass,
  keyPrefix,
  showChart,
  priceInsightsByWorkId,
}: {
  title: string;
  color: "amber" | "pink";
  works: Work[];
  gridClass: string;
  keyPrefix: string;
  showChart: boolean;
  priceInsightsByWorkId?: Map<number, HomePriceInsightWork>;
}) {
  if (works.length === 0) return null;
  return (
    <section className={color === "amber" ? "mt-8" : "mt-10"}>
      <SectionTitle title={title} count={works.length} color={color} />
      <div className={gridClass}>
        {works.map((work) => (
          <FanzaStyleWorkCard
            key={`${keyPrefix}${work.id}`}
            work={work}
            sourcePage="actress"
            insight={priceInsightsByWorkId?.get(work.id)}
            showChart={showChart}
          />
        ))}
      </div>
    </section>
  );
}

function ActressWorksPagination({
  actressName,
  currentPage,
  totalPages,
  pageHref,
}: Pick<Props, "actressName" | "currentPage" | "totalPages" | "pageHref">) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={`${actressName}の出演作品一覧のページ送り`} className="mt-8 flex items-center justify-center gap-3">
      <span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>
      {currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次のページ →</Link>}
    </nav>
  );
}

function ActressWorksList({
  actressName,
  currentPage,
  hasPageError,
  works,
  totalCount,
  totalPages,
  pageHref,
  priceInsightsByWorkId,
}: Pick<Props, "actressName" | "currentPage" | "hasPageError" | "works" | "totalCount" | "totalPages" | "pageHref" | "priceInsightsByWorkId">) {
  if (hasPageError) {
    return <div className="mt-10 rounded-lg border border-red-200 bg-white p-10 text-center font-black">作品を読み込めませんでした</div>;
  }
  if (works.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionTitle title="出演作品一覧" count={totalCount} color="pink" />
      <div className="grid max-w-[1500px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {works.map((work) => (
          <FanzaStyleWorkCard
            key={work.id}
            work={work}
            sourcePage="actress"
            insight={priceInsightsByWorkId.get(work.id)}
          />
        ))}
      </div>
      <ActressWorksPagination
        actressName={actressName}
        currentPage={currentPage}
        totalPages={totalPages}
        pageHref={pageHref}
      />
    </section>
  );
}

export default function ActressDetailPageView({
  actressName,
  currentPage,
  hasPageError,
  works,
  profile,
  totalCount,
  totalPages,
  topWork,
  highCostWorks,
  newestWorks,
  insightCandidatesCount,
  priceInsightsByWorkId,
  worksWithMultiDayPriceHistory,
  pageHref,
}: Props) {
  const topWorkGridClass = "grid max-w-[1500px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
  const latestWorkGridClass = "grid max-w-[1500px] grid-cols-2 gap-3 lg:grid-cols-4";
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
          <Link href="/actress" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-pink-600"><ArrowLeft size={15} /> 女優一覧に戻る</Link>
          <ActressProfileCard actressName={actressName} profile={profile} topWork={topWork} totalCount={totalCount} />
          <PriceHistoryNotice
            insightCandidatesCount={insightCandidatesCount}
            worksWithMultiDayPriceHistory={worksWithMultiDayPriceHistory}
          />
          <ActressWorkSection title="高コスパ作品" color="amber" works={highCostWorks} gridClass={topWorkGridClass} keyPrefix="cost-" showChart priceInsightsByWorkId={priceInsightsByWorkId} />
          <ActressWorkSection title="最新作" color="pink" works={newestWorks} gridClass={latestWorkGridClass} keyPrefix="new-" showChart={false} />
          <ActressWorksList
            actressName={actressName}
            currentPage={currentPage}
            hasPageError={hasPageError}
            works={works}
            totalCount={totalCount}
            totalPages={totalPages}
            pageHref={pageHref}
            priceInsightsByWorkId={priceInsightsByWorkId}
          />
        </div>
      </main>
    </>
  );
}
