import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Eye,
  ExternalLink,
  Megaphone,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type {
  WorkFunnelRow,
  XPostCategoryRevenueRow,
} from "@/lib/affiliateAnalytics";
import type { XCreativeLearningRow } from "@/lib/xPostLogs";

const RECOMMENDATION_RULES = {
  categoryMinPosts: 3,
  categoryMinPv: 40,
  categoryMinClicks: 3,
  categoryScaleCtr: 8,
  categoryScaleClicksPerPost: 1.5,
  categoryReduceMinPosts: 4,
  categoryReduceMinPv: 60,
  categoryReduceMaxCtr: 2,
  categoryReduceMaxClicksPerPost: 0.4,
  workMinPv: 20,
  workMinClicks: 3,
  workStrongCtr: 10,
  workWeakCtr: 2,
  ctaImproveMinPv: 60,
  ctaImproveMaxCtr: 2,
  exposureImproveMinCtr: 10,
  exposureImproveMaxPv: 30,
  maxItemsPerType: 5,
} as const;

type Priority = "high" | "medium" | "low";

type CategoryRecommendation = {
  key: string;
  category: string;
  label: string;
  priority: Priority;
  reason: string;
  posts: number;
  xPageViews: number;
  xFanzaClicks: number;
  xCtr: number;
  clicksPerPost: number;
};

type WorkRecommendation = {
  key: string;
  workId: number;
  title: string;
  priority: Priority;
  reason: string;
  pageViews: number;
  fanzaClicks: number;
  ctr: number;
  discoveryScore: number | null;
  ranking: number | null;
  latestPostedAt: string | null;
};

const priorityLabels: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const priorityStyles: Record<Priority, string> = {
  high: "border-rose-700 bg-rose-950/50 text-rose-200",
  medium: "border-amber-700 bg-amber-950/50 text-amber-200",
  low: "border-zinc-700 bg-zinc-800 text-zinc-300",
};

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function scoreConfidence({
  posts = 0,
  pageViews,
  clicks,
}: {
  posts?: number;
  pageViews: number;
  clicks: number;
}) {
  let score = 0;
  if (posts >= RECOMMENDATION_RULES.categoryMinPosts) score += 1;
  if (pageViews >= RECOMMENDATION_RULES.categoryMinPv) score += 1;
  if (clicks >= RECOMMENDATION_RULES.categoryMinClicks) score += 1;
  if (pageViews >= RECOMMENDATION_RULES.categoryMinPv * 2) score += 1;
  return score;
}

function priorityFromConfidence(confidence: number, preferred: Priority): Priority {
  if (confidence >= 4) return preferred;
  if (confidence >= 3) return preferred === "high" ? "medium" : preferred;
  return "low";
}

function buildCategoryScaleRecommendations(
  rows: XPostCategoryRevenueRow[],
): CategoryRecommendation[] {
  return rows
    .filter((row) =>
      row.posts >= RECOMMENDATION_RULES.categoryMinPosts &&
      row.xPageViews >= RECOMMENDATION_RULES.categoryMinPv &&
      row.xFanzaClicks >= RECOMMENDATION_RULES.categoryMinClicks &&
      (
        row.xCtr >= RECOMMENDATION_RULES.categoryScaleCtr ||
        row.clicksPerPost >= RECOMMENDATION_RULES.categoryScaleClicksPerPost
      )
    )
    .map((row) => {
      const confidence = scoreConfidence({
        posts: row.posts,
        pageViews: row.xPageViews,
        clicks: row.xFanzaClicks,
      });
      return {
        key: `scale-${row.category}`,
        category: row.category,
        label: row.label,
        priority: priorityFromConfidence(confidence, "high"),
        reason: `${row.label}: CTR ${formatPercent(row.xCtr)}、${row.posts}投稿、1投稿あたり${row.clicksPerPost.toFixed(1)}クリック → 投稿配分を増やす`,
        posts: row.posts,
        xPageViews: row.xPageViews,
        xFanzaClicks: row.xFanzaClicks,
        xCtr: row.xCtr,
        clicksPerPost: row.clicksPerPost,
      };
    })
    .sort((a, b) =>
      b.clicksPerPost - a.clicksPerPost ||
      b.xCtr - a.xCtr ||
      b.xFanzaClicks - a.xFanzaClicks
    )
    .slice(0, RECOMMENDATION_RULES.maxItemsPerType);
}

function buildCategoryReduceRecommendations(
  rows: XPostCategoryRevenueRow[],
): CategoryRecommendation[] {
  return rows
    .filter((row) =>
      row.posts >= RECOMMENDATION_RULES.categoryReduceMinPosts &&
      row.xPageViews >= RECOMMENDATION_RULES.categoryReduceMinPv &&
      row.xCtr <= RECOMMENDATION_RULES.categoryReduceMaxCtr &&
      row.clicksPerPost <= RECOMMENDATION_RULES.categoryReduceMaxClicksPerPost
    )
    .map((row) => {
      const confidence = scoreConfidence({
        posts: row.posts,
        pageViews: row.xPageViews,
        clicks: row.xFanzaClicks,
      });
      return {
        key: `reduce-${row.category}`,
        category: row.category,
        label: row.label,
        priority: priorityFromConfidence(confidence, "medium"),
        reason: `${row.label}: CTR ${formatPercent(row.xCtr)}、${row.posts}投稿、1投稿あたり${row.clicksPerPost.toFixed(1)}クリック → 投稿数を減らす/一時停止候補`,
        posts: row.posts,
        xPageViews: row.xPageViews,
        xFanzaClicks: row.xFanzaClicks,
        xCtr: row.xCtr,
        clicksPerPost: row.clicksPerPost,
      };
    })
    .sort((a, b) =>
      a.clicksPerPost - b.clicksPerPost ||
      a.xCtr - b.xCtr ||
      b.xPageViews - a.xPageViews
    )
    .slice(0, RECOMMENDATION_RULES.maxItemsPerType);
}

function buildRepostCandidates(rows: WorkFunnelRow[]): WorkRecommendation[] {
  return rows
    .filter((row) =>
      row.sourcePage === "x" &&
      row.pageViews >= RECOMMENDATION_RULES.workMinPv &&
      row.fanzaClicks >= RECOMMENDATION_RULES.workMinClicks &&
      row.ctr >= RECOMMENDATION_RULES.workStrongCtr
    )
    .map((row) => ({
      key: `repost-${row.workId}`,
      workId: row.workId,
      title: row.title,
      priority: priorityFromConfidence(
        scoreConfidence({
          pageViews: row.pageViews,
          clicks: row.fanzaClicks,
        }),
        "high",
      ),
      reason: `${row.pageViews}PV / ${row.fanzaClicks}送客 / CTR ${formatPercent(row.ctr)} → Xで再投稿候補`,
      pageViews: row.pageViews,
      fanzaClicks: row.fanzaClicks,
      ctr: row.ctr,
      discoveryScore: row.discoveryScore,
      ranking: row.ranking,
      latestPostedAt: row.latestPostedAt,
    }))
    .sort((a, b) => b.fanzaClicks - a.fanzaClicks || b.ctr - a.ctr)
    .slice(0, RECOMMENDATION_RULES.maxItemsPerType);
}

function buildCtaImproveCandidates(rows: WorkFunnelRow[]): WorkRecommendation[] {
  return rows
    .filter((row) =>
      row.pageViews >= RECOMMENDATION_RULES.ctaImproveMinPv &&
      row.ctr <= RECOMMENDATION_RULES.ctaImproveMaxCtr
    )
    .map((row) => {
      const priority: Priority = row.pageViews >= RECOMMENDATION_RULES.ctaImproveMinPv * 2
        ? "high"
        : "medium";
      return {
        key: `cta-${row.workId}-${row.sourcePage}`,
        workId: row.workId,
        title: row.title,
        priority,
        reason: `${row.pageViews}PVあるのにCTR ${formatPercent(row.ctr)} → 作品詳細のCTA・冒頭訴求を改善`,
        pageViews: row.pageViews,
        fanzaClicks: row.fanzaClicks,
        ctr: row.ctr,
        discoveryScore: row.discoveryScore,
        ranking: row.ranking,
        latestPostedAt: row.latestPostedAt,
      };
    })
    .sort((a, b) => b.pageViews - a.pageViews || a.ctr - b.ctr)
    .slice(0, RECOMMENDATION_RULES.maxItemsPerType);
}

function buildExposureImproveCandidates(rows: WorkFunnelRow[]): WorkRecommendation[] {
  return rows
    .filter((row) =>
      row.pageViews > 0 &&
      row.pageViews <= RECOMMENDATION_RULES.exposureImproveMaxPv &&
      row.fanzaClicks >= RECOMMENDATION_RULES.workMinClicks &&
      row.ctr >= RECOMMENDATION_RULES.exposureImproveMinCtr
    )
    .map((row) => {
      const priority: Priority = row.fanzaClicks >= RECOMMENDATION_RULES.workMinClicks * 2
        ? "high"
        : "medium";
      return {
        key: `exposure-${row.workId}-${row.sourcePage}`,
        workId: row.workId,
        title: row.title,
        priority,
        reason: `${row.pageViews}PV / ${row.fanzaClicks}送客 / CTR ${formatPercent(row.ctr)} → 投稿時間・カテゴリ配分で露出改善`,
        pageViews: row.pageViews,
        fanzaClicks: row.fanzaClicks,
        ctr: row.ctr,
        discoveryScore: row.discoveryScore,
        ranking: row.ranking,
        latestPostedAt: row.latestPostedAt,
      };
    })
    .sort((a, b) => b.ctr - a.ctr || b.fanzaClicks - a.fanzaClicks)
    .slice(0, RECOMMENDATION_RULES.maxItemsPerType);
}

function RecommendationShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0 text-emerald-300" size={20} />
        <div>
          <h3 className="text-sm font-black text-zinc-100">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function EmptyState() {
  return (
    <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-xs leading-5 text-zinc-500">
      まだ判定に必要なサンプル数に届いていません。投稿数・PV・クリックが閾値を超えるまで保留します。
    </p>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${priorityStyles[priority]}`}>
      優先度 {priorityLabels[priority]}
    </span>
  );
}

function CategoryCard({ item }: { item: CategoryRecommendation }) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-zinc-100">{item.label}</p>
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-400">{item.reason}</p>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-zinc-500">
        <span>{item.posts}投稿</span>
        <span>{item.xPageViews}PV</span>
        <span>{item.xFanzaClicks}送客</span>
        <span>{formatPercent(item.xCtr)}</span>
      </div>
    </article>
  );
}

function WorkCard({ item }: { item: WorkRecommendation }) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/works/${item.workId}`}
          className="min-w-0 flex flex-1 items-center gap-2 font-bold text-zinc-100 hover:text-pink-300"
        >
          <span className="line-clamp-2">{item.title}</span>
          <ExternalLink className="shrink-0" size={13} />
        </Link>
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-400">{item.reason}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-zinc-500">
        <span className="rounded-full bg-zinc-950 px-2.5 py-1">{item.pageViews}PV</span>
        <span className="rounded-full bg-zinc-950 px-2.5 py-1">{item.fanzaClicks}送客</span>
        <span className="rounded-full bg-zinc-950 px-2.5 py-1">CTR {formatPercent(item.ctr)}</span>
        <span className="rounded-full bg-zinc-950 px-2.5 py-1">発掘指数 {item.discoveryScore ?? "-"}</span>
        <span className="rounded-full bg-zinc-950 px-2.5 py-1">順位 {item.ranking ?? "-"}</span>
      </div>
    </article>
  );
}

export default function SalesRecommendationPanel({
  days,
  categories,
  workFunnels,
  creativeLearning,
}: {
  days: number;
  categories: XPostCategoryRevenueRow[];
  workFunnels: WorkFunnelRow[];
  creativeLearning: XCreativeLearningRow[];
}) {
  const scaleCategories = buildCategoryScaleRecommendations(categories);
  const reduceCategories = buildCategoryReduceRecommendations(categories);
  const repostCandidates = buildRepostCandidates(workFunnels);
  const ctaImproveCandidates = buildCtaImproveCandidates(workFunnels);
  const exposureImproveCandidates = buildExposureImproveCandidates(workFunnels);
  const creativeRecommendations = creativeLearning
    .filter((row) => row.confidence !== "low")
    .slice(0, 4);

  return (
    <section className="mt-6 rounded-2xl border border-emerald-900/80 bg-emerald-950/20 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-emerald-300">
            SALES RECOMMENDATIONS
          </p>
          <h2 className="mt-2 text-xl font-black">売上改善レコメンド</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            直近{days}日のXカテゴリ別ファネルと直近30日の作品別ファネルから、今日増やす投稿・減らす投稿・直す作品を自動判定します。
          </p>
        </div>
        <Link
          href="/admin/revenue#x-post-candidates"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-800 bg-zinc-950 px-4 text-xs font-black text-emerald-200 transition hover:border-emerald-400"
        >
          <Megaphone size={15} /> 投稿候補へ
        </Link>
      </div>

      <div className="mt-5 grid gap-3 text-xs leading-5 text-zinc-400 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="font-black text-zinc-200">カテゴリ判定</p>
          <p className="mt-1">{RECOMMENDATION_RULES.categoryMinPosts}投稿・{RECOMMENDATION_RULES.categoryMinPv}PV・{RECOMMENDATION_RULES.categoryMinClicks}クリック以上で増加候補。</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="font-black text-zinc-200">停止候補</p>
          <p className="mt-1">{RECOMMENDATION_RULES.categoryReduceMinPosts}投稿・{RECOMMENDATION_RULES.categoryReduceMinPv}PV以上、CTR {RECOMMENDATION_RULES.categoryReduceMaxCtr}%以下。</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="font-black text-zinc-200">作品判定</p>
          <p className="mt-1">再投稿は{RECOMMENDATION_RULES.workMinPv}PV・{RECOMMENDATION_RULES.workMinClicks}クリック・CTR {RECOMMENDATION_RULES.workStrongCtr}%以上。</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="font-black text-zinc-200">信頼度補正</p>
          <p className="mt-1">PVやクリックが薄い候補は優先度を下げ、早すぎる判断を避けます。</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <RecommendationShell
          title="クリエイティブ配分"
          description="Hook・画像・リンク・CTAの補正CTRから、次に増やす見せ方を提案します。"
          icon={Sparkles}
        >
          {creativeRecommendations.length ? creativeRecommendations.map((item) => (
            <article key={`${item.dimension}-${item.value}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-zinc-100">{item.label}</p>
                <PriorityBadge priority={item.confidence === "high" ? "high" : "medium"} />
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                {item.posts}投稿 / {item.xPageViews}PV / {item.xFanzaClicks}送客 / 補正CTR {formatPercent(item.adjustedCtr)} → {item.recommendation}
              </p>
            </article>
          )) : <EmptyState />}
        </RecommendationShell>

        <RecommendationShell
          title="カテゴリを増やす"
          description="CTRまたはクリック/投稿が強く、最低サンプルを超えた投稿カテゴリです。"
          icon={ArrowUpCircle}
        >
          {scaleCategories.length ? scaleCategories.map((item) => (
            <CategoryCard key={item.key} item={item} />
          )) : <EmptyState />}
        </RecommendationShell>

        <RecommendationShell
          title="カテゴリを減らす/停止候補"
          description="一定数出してもCTRとクリック/投稿が弱いカテゴリです。"
          icon={ArrowDownCircle}
        >
          {reduceCategories.length ? reduceCategories.map((item) => (
            <CategoryCard key={item.key} item={item} />
          )) : <EmptyState />}
        </RecommendationShell>

        <RecommendationShell
          title="再投稿候補作品"
          description="X経由で高CTR・クリックあり。投稿文や時間を変えて再利用する候補です。"
          icon={RefreshCw}
        >
          {repostCandidates.length ? repostCandidates.map((item) => (
            <WorkCard key={item.key} item={item} />
          )) : <EmptyState />}
        </RecommendationShell>

        <RecommendationShell
          title="PV高・CTR低のCTA改善候補"
          description="見られているのにFANZA送客へ進んでいない作品詳細です。"
          icon={Wrench}
        >
          {ctaImproveCandidates.length ? ctaImproveCandidates.map((item) => (
            <WorkCard key={item.key} item={item} />
          )) : <EmptyState />}
        </RecommendationShell>

        <RecommendationShell
          title="PV低・CTR高の露出改善候補"
          description="少ないPVでもクリック率が高い作品。投稿時間・カテゴリ配分・再掲で露出を増やします。"
          icon={Eye}
        >
          {exposureImproveCandidates.length ? exposureImproveCandidates.map((item) => (
            <WorkCard key={item.key} item={item} />
          )) : <EmptyState />}
        </RecommendationShell>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 shrink-0 text-amber-300" size={20} />
            <div>
              <h3 className="text-sm font-black text-zinc-100">今日の読み方</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                まず優先度「高」を処理し、次にカテゴリ配分を調整します。該当なしは失敗ではなく、判定を保留してデータを貯める状態です。
              </p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
