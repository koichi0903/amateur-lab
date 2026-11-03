import Link from "next/link";

import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { xGrowthMediaPreviewUrl } from "@/lib/xGrowthMediaPreview";
import { getRightsReviewQueue, isOfficialFanzaDmmSampleUrl } from "@/lib/xMediaAssets";
import { RightsReviewActions } from "./XGrowthActions";
import { TrimReviewActions } from "./XGrowthManualPostActions";
import XDailyImpressionTasks from "./XDailyImpressionTasks";
import VideoCandidatePool from "./VideoCandidatePool";
import OperatorPostDirective from "./OperatorPostDirective";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-zinc-800 bg-zinc-900 p-5 ${className}`}>{children}</section>;
}

type RightsReviewAsset = Awaited<ReturnType<typeof getRightsReviewQueue>>["rows"][number];

function sampleMoviePreviewUrl(workId: number | null | undefined, assetId?: number | null) {
  if (!workId) return "";
  return xGrowthMediaPreviewUrl({ workId, mediaType: "sample_movie", mediaAssetId: assetId });
}

function RightsReviewList({
  rows,
  emptyMessage,
  error,
}: {
  rows: readonly RightsReviewAsset[];
  emptyMessage: string;
  error?: string | null;
}) {
  return (
    <div className="mt-4 space-y-3">
      {rows.map((asset) => (
        <div key={asset.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-700 px-2 py-1 text-[10px] font-black text-amber-200">{asset.rights_status}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{asset.fetch_status ?? "fetch未確認"}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{asset.source_kind ?? "unknown"}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-black text-zinc-200">{String(asset.works?.title ?? `work ${asset.work_id}`)}</p>
          <p className="mt-1 break-all text-[11px] leading-5 text-zinc-500">{asset.source_domain} / {asset.source_url}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={sampleMoviePreviewUrl(asset.work_id, asset.id)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-lg border border-cyan-700 px-2 text-[11px] font-black text-cyan-100">動画を開く</a>
            <a href={`/works/${asset.work_id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-700 px-2 text-[11px] font-black text-zinc-100">作品</a>
          </div>
          <TrimReviewActions
            assetId={asset.id}
            sourceUrl={sampleMoviePreviewUrl(asset.work_id, asset.id)}
            initialTrimStartSeconds={asset.trim_start_seconds}
            initialTrimNote={asset.trim_note}
            canModify={asset.can_modify}
            trimModifyConfirmed={asset.trim_modify_confirmed}
            trimAllowed={isOfficialFanzaDmmSampleUrl(asset.source_url)}
          />
          <RightsReviewActions assetId={asset.id} />
        </div>
      ))}
      {!rows.length && <p className="text-sm text-zinc-500">{emptyMessage}</p>}
      {error && <p className="text-sm font-bold text-rose-200">{error}</p>}
    </div>
  );
}

function TopPicksSkeleton() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
          <ArrowLeft size={16} /> 管理画面へ戻る
        </Link>
        <Panel className="mt-8 border-emerald-700 bg-emerald-950/10">
          <div className="flex items-center gap-2"><Sparkles className="text-emerald-300" size={20} /><h1 className="text-2xl font-black">X運営ツールを読み込み中</h1></div>
          <p role="status" className="mt-3 text-sm leading-6 text-emerald-100/80">日次タスクと素材確認を読み込んでいます。</p>
        </Panel>
      </div>
    </main>
  );
}

async function XGrowthPageContent() {
  const mediaReview = await getRightsReviewQueue(12);
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
          <ArrowLeft size={16} /> 管理画面へ戻る
        </Link>
        <div className="mt-7">
          <p className="text-xs font-black tracking-[0.18em] text-emerald-300">HAKKUTSU X GROWTH</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">X運営ツール</h1>
        </div>
        <Suspense fallback={<section className="mt-6 rounded-2xl border border-emerald-800 bg-emerald-950/15 p-5" aria-busy="true"><h2 className="text-xl font-black">Xデイリータスク</h2><p role="status" className="mt-2 text-sm text-zinc-400">投稿タスクを読み込んでいます。</p></section>}>
          <XDailyImpressionTasks />
        </Suspense>
        <Panel className="mt-6">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="flex items-center gap-2"><Sparkles className="text-emerald-300" size={20} /><span className="text-lg font-black">素材管理 / Media Rights Review</span></span>
                <span className="mt-1 block text-sm leading-6 text-zinc-400">動画素材の権利確認とtrim編集を行います。</span>
              </span>
              <span className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-200">素材管理を開く</span>
            </summary>
            <RightsReviewList rows={mediaReview.rows} emptyMessage="レビュー対象の動画候補はまだ同期されていません。" error={mediaReview.error} />
          </details>
        </Panel>
      </div>
    </main>
  );
}

export default function XGrowthPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <OperatorPostDirective />
        <details className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <summary className="cursor-pointer text-sm font-black text-zinc-300">作品・素材の参考候補を開く（投稿指示ではありません）</summary>
          <div className="mt-4"><VideoCandidatePool /></div>
        </details>
      </div>
      <Suspense fallback={<TopPicksSkeleton />}>
        <XGrowthPageContent />
      </Suspense>
    </div>
  );
}
