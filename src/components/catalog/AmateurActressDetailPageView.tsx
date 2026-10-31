import Link from "next/link";
import { ArrowLeft, CalendarDays, Ruler, Shapes } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkCategorySwitch from "@/components/catalog/WorkCategorySwitch";
import WorkImage from "@/components/home/WorkImage";
import FanzaAmateurTopCard from "@/components/catalog/FanzaAmateurTopCard";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import { SITE_URL } from "@/lib/seo";
import { getFanzaAmateurActressIndex, getFanzaAmateurActressWorks } from "@/lib/dmm/fanzaAmateurCatalog";

type ActressSummary = Awaited<ReturnType<typeof getFanzaAmateurActressIndex>>["items"][number];
type ActressCard = Awaited<ReturnType<typeof getFanzaAmateurActressWorks>>["cards"][number];

type Props = {
  actressName: string;
  currentPage: number;
  totalCount: number;
  totalPages: number;
  summary: ActressSummary;
  profileImage: string | null;
  currentCards: ActressCard[];
  highCostWorks: ActressCard[];
  newestWorks: ActressCard[];
  pageDescription: string;
  canonicalUrl: string;
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

function ActressBirthdayFact({ summary }: { summary: ActressSummary }) {
  return <p className="flex items-center gap-2 text-slate-500"><CalendarDays size={15} /> 生年月日 <strong className="text-slate-800">{summary.birthday ?? "未取得"}</strong></p>;
}

function ActressHeightFact({ summary }: { summary: ActressSummary }) {
  return <p className="flex items-center gap-2 text-slate-500"><Ruler size={15} /> 身長 <strong className="text-slate-800">{summary.height_cm ? `${summary.height_cm} cm` : "未取得"}</strong></p>;
}

function ActressMeasurementsFact({ summary }: { summary: ActressSummary }) {
  const measurementText = summary.bust_cm || summary.waist_cm || summary.hip_cm
    ? `B${summary.bust_cm ?? "-"} / W${summary.waist_cm ?? "-"} / H${summary.hip_cm ?? "-"}`
    : "未取得";
  return <p className="flex items-center gap-2 text-sm text-slate-500"><Shapes size={15} /> スリーサイズ <strong className="text-slate-800">{measurementText}</strong></p>;
}

function ActressProfileCard({ actressName, summary, profileImage, totalCount }: Pick<Props, "actressName" | "summary" | "profileImage" | "totalCount">) {
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-pink-600 bg-slate-100 sm:h-32 sm:w-32">
          <WorkImage src={profileImage} fallbackSrc={summary.image_url} alt={`${actressName}のプロフィール写真`} sizes="128px" unoptimized className="object-cover" />
        </div>
        <div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-3 sm:items-center">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">{actressName}の出演作品・プロフィール</h1>
            {summary.ruby && <p className="mt-1 text-sm text-slate-500">{summary.ruby}</p>}
          </div>
          <div className="space-y-2 text-sm">
            <ActressBirthdayFact summary={summary} />
            <ActressHeightFact summary={summary} />
          </div>
          <ActressMeasurementsFact summary={summary} />
        </div>
      </div>
      <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">出演が確認できた素人作品は全{totalCount.toLocaleString("ja-JP")}作品です。プロフィール写真はFANZA女優情報を使用し、登録がない場合は素人作品の画像を表示します。</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">作品ごとの価格情報を掲載し、発掘LABで価格履歴を記録している作品はチャートで推移を確認できます。出演者名は素人作品データとの照合で確認できたものを掲載しています。</p>
    </section>
  );
}

function HighCostWorksSection({ works }: { works: ActressCard[] }) {
  if (works.length === 0) return null;
  return (
    <section className="mt-8">
      <SectionTitle title="高コスパ作品" count={works.length} color="amber" />
      <div className="grid max-w-[1500px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {works.map((card) => <FanzaAmateurTopCard key={`cost-${card.item.content_id}`} card={card} sourcePage="amateur_detail" />)}
      </div>
    </section>
  );
}

function NewestWorksSection({ works }: { works: ActressCard[] }) {
  if (works.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionTitle title="最新作" count={works.length} color="pink" />
      <div className="grid max-w-[1500px] grid-cols-2 gap-3 lg:grid-cols-4">
        {works.map((card) => <FanzaAmateurTopCard key={`new-${card.item.content_id}`} card={card} showChart={false} showRank={false} sourcePage="amateur_detail" />)}
      </div>
    </section>
  );
}

function ActressWorksPagination({ actressName, currentPage, totalPages, pageHref }: Pick<Props, "actressName" | "currentPage" | "totalPages" | "pageHref">) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={`${actressName}の出演作品一覧のページ送り`} className="mt-8 flex items-center justify-center gap-3">
      {currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="rounded border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}
      <span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>
      {currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次のページ →</Link>}
    </nav>
  );
}

function CurrentWorksSection({
  actressName,
  currentPage,
  totalCount,
  totalPages,
  currentCards,
  pageHref,
}: Pick<Props, "actressName" | "currentPage" | "totalCount" | "totalPages" | "currentCards" | "pageHref">) {
  if (currentCards.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionTitle title="出演作品一覧" count={totalCount} color="pink" />
      <div className="grid max-w-[1500px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {currentCards.map((card) => <FanzaAmateurTopCard key={card.item.content_id} card={card} showRank={false} sourcePage="amateur_detail" />)}
      </div>
      <ActressWorksPagination actressName={actressName} currentPage={currentPage} totalPages={totalPages} pageHref={pageHref} />
    </section>
  );
}

export default function AmateurActressDetailPageView({
  actressName,
  currentPage,
  totalCount,
  totalPages,
  summary,
  profileImage,
  currentCards,
  highCostWorks,
  newestWorks,
  pageDescription,
  canonicalUrl,
  pageHref,
}: Props) {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
          <CollectionPageJsonLd
            title={`${actressName}のFANZA素人出演作品・プロフィール | 発掘LAB`}
            description={pageDescription}
            url={canonicalUrl}
            items={currentCards.map((card) => ({
              name: card.item.title,
              url: `${SITE_URL}/amateur/${encodeURIComponent(card.item.content_id)}`,
              image: card.item.imageURL?.large || card.item.imageURL?.small || card.item.imageUrl,
            }))}
          />
          <WorkCategorySwitch active="amateur" />
          <Link href="/amateur/actress" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-pink-600"><ArrowLeft size={15} /> 素人女優一覧に戻る</Link>
          <ActressProfileCard actressName={actressName} summary={summary} profileImage={profileImage} totalCount={totalCount} />
          <HighCostWorksSection works={highCostWorks} />
          <NewestWorksSection works={newestWorks} />
          <CurrentWorksSection
            actressName={actressName}
            currentPage={currentPage}
            totalCount={totalCount}
            totalPages={totalPages}
            currentCards={currentCards}
            pageHref={pageHref}
          />
        </div>
      </main>
    </>
  );
}
