"use client";

import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileUp, LoaderCircle, MousePointerClick, Plus, RefreshCw, Save } from "lucide-react";
import type { MyfansQuoteCollectionTask } from "@/lib/myfansXExecution";
import type { MyfansApprovedMedia, MyfansCreator, MyfansProduct, MyfansXPost } from "@/lib/myfansAnalytics";
import type { PersistedDailyCandidateView, PersistedDailySnapshotView } from "@/lib/myfansDailySnapshotView";
import type { Message } from "./MyfansFormPrimitives";
import { inputClass, StatusMessage } from "./MyfansFormPrimitives";
import { postFormData } from "./myfansFormApi";
export { XExecutionBoard } from "./XExecutionBoard";
export { QuoteRefreshBatchPanel } from "./MyfansWorkerPanels";

function useMyfansSubmit(successText: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/myfans", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "保存に失敗しました。");
      event.currentTarget.reset();
      setMessage({ text: successText, error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "保存に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  return { pending, message, submit };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-zinc-400">{label}{children}</label>;
}

const textareaClass = "min-h-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-emerald-500";

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60">
      {pending ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
      {pending ? "保存中" : label}
    </button>
  );
}


export function DailyPlanReevaluateButton({ approvedMediaId }: { approvedMediaId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function reevaluate() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/myfans/daily-plan/reevaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvedMediaId }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "再評価に失敗しました。保存状態は変更されていません。");
      if (payload.error) throw new Error(payload.error);
      setMessage({ text: "Daily Planを保存しました。", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "再評価に失敗しました。保存状態は変更されていません。", error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={reevaluate} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">
        {pending ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
        {pending ? "4×3を再評価中…" : "4×3を再評価・保存"}
      </button>
      {message && <p role="status" className={`text-xs ${message.error ? "text-red-300" : "text-emerald-300"}`}>{message.text}</p>}
    </div>
  );
}

export function MarketWinnerGenerateButton({ approvedMediaId }: { approvedMediaId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function generate() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/myfans/market-winner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedMediaId }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; sharedSupplyCount?: number; createdCount?: number; updatedCount?: number; generatedAt?: string; scoreRange?: { min: number; max: number } | null };
      if (!response.ok) throw new Error(payload.error || "Winner候補の生成・更新に失敗しました。");
      const score = payload.scoreRange ? ` / score ${payload.scoreRange.min.toFixed(1)}〜${payload.scoreRange.max.toFixed(1)}` : "";
      setMessage({ text: `共有供給${payload.sharedSupplyCount ?? 0}件から、生成${payload.createdCount ?? 0}件・更新${payload.updatedCount ?? 0}件${score}。${payload.generatedAt ? ` ${new Date(payload.generatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false })}` : ""}`, error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Winner候補の生成・更新に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  return <div className="flex flex-col items-start gap-2"><button type="button" onClick={generate} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-fuchsia-500 px-4 text-sm font-black text-black disabled:cursor-wait disabled:opacity-60"><RefreshCw size={17} className={pending ? "animate-spin" : ""} />{pending ? "Winner候補を生成中…" : "Winner候補を生成・更新"}</button>{message && <p role="status" className={`text-xs ${message.error ? "text-red-300" : "text-emerald-300"}`}>{message.text}</p>}</div>;
}

export function PersistedDailyPlanBoard({ snapshot }: { snapshot: PersistedDailySnapshotView }) {
  return (
    <section className="space-y-5" aria-labelledby="persisted-daily-plan-title">
      <div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-5">
        <p className="text-xs font-black tracking-[0.16em] text-emerald-300">PERSISTED DAILY SNAPSHOT</p>
        <h2 id="persisted-daily-plan-title" className="mt-2 text-xl font-black">保存済みDaily Planを表示中</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-400">plan {snapshot.planId} / revision {snapshot.revision ?? "-"} / selected {snapshot.selectedCount}件 / 保存時刻 {snapshot.evaluatedAt ? new Date(snapshot.evaluatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }) : "-"}</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">再評価を実行するまで、候補0件のlive計算結果でこの保存状態を上書きしません。slot番号と空slotは保存値をそのまま表示します。</p>
      </div>
      {snapshot.slots.map((slot) => {
        const selectedLabel = snapshot.selectedOptions[String(slot.postOrder)] ?? "";
        return (
          <article key={`${slot.slot}-${slot.postOrder}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black text-emerald-300">Slot{slot.postOrder} / {slot.slot || "保存値"}</p>
                <h2 className="mt-1 text-xl font-black">保存済み候補</h2>
              </div>
              <p className="text-xs font-black text-zinc-400">選択済み: {selectedLabel || "なし"}</p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {slot.candidates.map((candidate) => <PersistedDailyCandidateCard key={candidate.id} candidate={candidate} selected={selectedLabel === candidate.optionLabel} />)}
            </div>
          </article>
        );
      })}
      {!snapshot.slots.length && <p className="rounded-xl border border-amber-800 bg-amber-950/20 p-5 text-sm text-amber-200">保存済みplanの候補snapshotが空です。再評価は実行せず、保存状態を保持しています。</p>}
    </section>
  );
}

function PersistedDailyCandidateCard({ candidate, selected }: { candidate: PersistedDailyCandidateView; selected: boolean }) {
  return <div className={`rounded-lg border p-4 ${selected ? "border-emerald-500 bg-emerald-950/25" : "border-zinc-800 bg-zinc-950"}`}>
    <PersistedCandidateHeading candidate={candidate} selected={selected} />
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-xs font-black text-zinc-500">公開本文全文</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-100">{candidate.body || "保存済み本文なし"}</p>
    </div>
    <PersistedCandidateMetadata candidate={candidate} />
  </div>;
}

function PersistedCandidateHeading({ candidate, selected }: { candidate: PersistedDailyCandidateView; selected: boolean }) {
  return <div className="flex items-start justify-between gap-3">
    <div>
      <p className="text-sm font-black text-white">候補{candidate.optionLabel}（{candidate.optionName}）</p>
      <p className="mt-1 text-xs font-bold text-zinc-500">{candidate.candidateType || "保存済み候補"} / {candidate.role || "-"} / {candidate.postType || "-"}</p>
    </div>
    <span className={`rounded-md px-2 py-1 text-[11px] font-black ${selected ? "bg-emerald-400 text-black" : "bg-zinc-800 text-zinc-300"}`}>{selected ? "選択済み" : "未選択"}</span>
  </div>;
}

function PersistedCandidateMetadata({ candidate }: { candidate: PersistedDailyCandidateView }) {
  return <div className="mt-3 grid gap-1 text-xs leading-5 text-zinc-300">
    <PersistedCandidateSourceMetadata candidate={candidate} />
    <PersistedCandidateProductMetadata candidate={candidate} />
    <PersistedCandidateQualityMetadata candidate={candidate} />
  </div>;
}

function PersistedCandidateSourceMetadata({ candidate }: { candidate: PersistedDailyCandidateView }) {
  return <>
    <p><span className="font-black text-zinc-500">引用元X:</span> {candidate.quoteXUrl || candidate.sourceXUrl || "-"}</p>
    <p><span className="font-black text-zinc-500">引用画像/動画:</span> {candidate.mediaPermalink || "なし（status URLを使用）"}</p>
  </>;
}

function PersistedCandidateProductMetadata({ candidate }: { candidate: PersistedDailyCandidateView }) {
  return <>
    <p><span className="font-black text-zinc-500">候補タイプ:</span> {candidate.candidateType || "-"} / {candidate.monetizableStatus || "unlinked"}</p>
    <p><span className="font-black text-zinc-500">myfans作品:</span> {candidate.productTitle || "なし"}</p>
    <p><span className="font-black text-zinc-500">送客先:</span> {candidate.myfansTargetUrl || "なし"}</p>
    <p><span className="font-black text-zinc-500">アフィリエイト:</span> {candidate.affiliateUrl ? candidate.affiliateUrl : "なし（product-less discoveryを含む）"}</p>
  </>;
}

function PersistedCandidateQualityMetadata({ candidate }: { candidate: PersistedDailyCandidateView }) {
  return <>
    <p><span className="font-black text-zinc-500">Quality:</span> {candidate.quality ?? "-"} / Topic Value {candidate.topicValue ?? "-"}</p>
    <p><span className="font-black text-zinc-500">新規性:</span> {candidate.noveltyLabel || "保存値"} / 同じsource: {candidate.sameSourceStatus || "-"}</p>
  </>;
}

export function CreatorForm() {
  const { pending, message, submit } = useMyfansSubmit("クリエイターを保存しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-2">
      <input type="hidden" name="action" value="creator" />
      <Field label="クリエイター名"><input name="display_name" required className={inputClass} /></Field>
      <Field label="ジャンル"><input name="genre" className={inputClass} /></Field>
      <Field label="myfans URL"><input name="myfans_url" type="url" className={inputClass} /></Field>
      <Field label="X URL"><input name="x_url" type="url" className={inputClass} /></Field>
      <Field label="活動メモ"><textarea name="activity_note" className={`${textareaClass} lg:col-span-2`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <SubmitButton pending={pending} label="クリエイターを追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function MediaForm() {
  const { pending, message, submit } = useMyfansSubmit("承認済みメディアを保存しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-3">
      <input type="hidden" name="action" value="media" />
      <Field label="メディア名"><input name="media_name" required className={inputClass} /></Field>
      <Field label="メディアURL"><input name="media_url" type="url" className={inputClass} /></Field>
      <Field label="アフィリエイトメディアID"><input name="affiliate_media_id" className={inputClass} /></Field>
      <Field label="メモ"><textarea name="notes" className={`${textareaClass} lg:col-span-3`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
        <SubmitButton pending={pending} label="メディアを追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function ProductForm({ creators, media }: { creators: MyfansCreator[]; media: MyfansApprovedMedia[] }) {
  const { pending, message, submit } = useMyfansSubmit("商品を保存しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-4">
      <input type="hidden" name="action" value="product" />
      <Field label="商品名"><input name="title" required className={`${inputClass} lg:col-span-2`} /></Field>
      <Field label="クリエイター"><select name="creator_id" className={inputClass}><option value="">未選択</option>{creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.display_name}</option>)}</select></Field>
      <Field label="状態"><select name="status" className={inputClass}><option value="candidate">candidate</option><option value="approved">approved</option><option value="posted">posted</option><option value="paused">paused</option><option value="rejected">rejected</option></select></Field>
      <Field label="商品URL"><input name="product_url" type="url" className={inputClass} /></Field>
      <Field label="アフィリンク"><input name="affiliate_url" type="url" className={inputClass} /></Field>
      <Field label="引用元X URL"><input name="source_x_url" type="url" className={inputClass} /></Field>
      <Field label="ジャンル"><input name="genre" className={inputClass} /></Field>
      <Field label="商品種別"><select name="product_type" className={inputClass}><option value="single">単品</option><option value="plan">プラン</option><option value="backnumber_plan">バックナンバー</option><option value="backnumber_month">月別</option><option value="gacha">ガチャ</option><option value="other">その他</option></select></Field>
      <Field label="価格"><input name="price" type="number" min="0" className={inputClass} /></Field>
      <Field label="報酬率 %"><input name="reward_rate" type="number" min="0" step="0.01" className={inputClass} /></Field>
      <Field label="プラン加入報酬"><input name="plan_signup_reward" type="number" min="0" className={inputClass} /></Field>
      <Field label="継続報酬率 %"><input name="recurring_reward_rate" type="number" min="0" step="0.01" className={inputClass} /></Field>
      <Field label="人気順位"><input name="popularity_rank" type="number" min="1" className={inputClass} /></Field>
      <Field label="いいね"><input name="likes_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="保存"><input name="saves_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="新着"><select name="is_new" className={inputClass}><option value="false">いいえ</option><option value="true">はい</option></select></Field>
      <Field label="承認済みメディア"><select name="approved_media_name" className={inputClass}><option value="">未選択</option>{media.map((item) => <option key={item.id} value={item.media_name}>{item.media_name}</option>)}</select></Field>
      <Field label="承認メディアURL"><input name="approved_media_url" type="url" className={inputClass} /></Field>
      <Field label="メディアID"><input name="affiliate_media_id" className={inputClass} /></Field>
      <Field label="選定理由"><textarea name="selection_reason" className={`${textareaClass} lg:col-span-4`} /></Field>
      <Field label="メモ"><textarea name="notes" className={`${textareaClass} lg:col-span-4`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-4">
        <SubmitButton pending={pending} label="商品を追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function PostForm({ products }: { products: MyfansProduct[] }) {
  const { pending, message, submit } = useMyfansSubmit("投稿候補を保存しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-3">
      <input type="hidden" name="action" value="post" />
      <Field label="商品"><select name="product_id" className={inputClass}><option value="">未選択</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></Field>
      <Field label="投稿型"><select name="post_type" className={inputClass}><option value="discovery_interest">発見・興味</option><option value="ranking_note">ランキング観測</option><option value="comparison_review">比較レビュー</option><option value="profile_cta">プロフィール誘導</option><option value="body_link_sales">本文リンク収益</option><option value="reply_link_sales">自己リプ収益</option><option value="winner_reuse">勝ち型再利用</option><option value="discovery">発掘</option><option value="comparison">比較</option><option value="avoid_bad_buy">ハズレ回避</option><option value="new_creator">新人</option><option value="single_intro">単品紹介</option><option value="trend">トレンド</option><option value="other">その他</option></select></Field>
      <Field label="状態"><select name="status" className={inputClass}><option value="draft">draft</option><option value="ready">ready</option><option value="posted">posted</option><option value="archived">archived</option></select></Field>
      <Field label="本文"><textarea name="body" required className={`${textareaClass} lg:col-span-3`} /></Field>
      <Field label="自己リプ"><textarea name="self_reply" className={`${textareaClass} lg:col-span-3`} /></Field>
      <Field label="#PR"><select name="includes_pr" className={inputClass}><option value="true">あり</option><option value="false">なし</option></select></Field>
      <Field label="引用元X URL"><input name="source_x_url" type="url" className={inputClass} /></Field>
      <Field label="アフィリンク"><input name="affiliate_url" type="url" className={inputClass} /></Field>
      <Field label="投稿予定"><input name="scheduled_at" type="datetime-local" className={inputClass} /></Field>
      <Field label="投稿日時"><input name="posted_at" type="datetime-local" className={inputClass} /></Field>
      <Field label="投稿URL"><input name="x_post_url" type="url" className={inputClass} /></Field>
      <Field label="投稿担当"><input name="actual_posted_by" className={inputClass} /></Field>
      <Field label="インプレッション"><input name="impressions" type="number" min="0" className={inputClass} /></Field>
      <Field label="いいね"><input name="likes_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="リポスト"><input name="reposts_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="返信"><input name="replies_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="クリック"><input name="clicks" type="number" min="0" className={inputClass} /></Field>
      <Field label="成長ステージ"><input name="growth_stage" className={inputClass} /></Field>
      <Field label="リンク戦略"><select name="link_strategy" className={inputClass}><option value="no_link">no_link</option><option value="profile_cta">profile_cta</option><option value="body_link">body_link</option><option value="reply_link">reply_link</option></select></Field>
      <Field label="CTA戦略"><input name="cta_strategy" className={inputClass} /></Field>
      <Field label="目的"><select name="objective" className={inputClass}><option value="impression">impression</option><option value="profile_visit">profile_visit</option><option value="follow">follow</option><option value="click">click</option><option value="conversion">conversion</option></select></Field>
      <Field label="選定理由"><textarea name="selection_reason" className={`${textareaClass} lg:col-span-3`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
        <SubmitButton pending={pending} label="投稿候補を追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function QuoteCandidateTasks({ tasks }: { tasks: MyfansQuoteCollectionTask[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function submit(productId: number, form: HTMLFormElement) {
    setPendingId(productId);
    setMessage(null);
    try {
      const formData = new FormData(form);
      formData.set("action", "quote_candidate_update");
      formData.set("product_id", String(productId));
      await postFormData(formData);
      setMessage({ text: "引用候補URLを登録しました。次回の投稿候補でquote_postを選べます。", error: false });
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "引用候補URLを登録できませんでした。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section id="quote-refresh" className="mt-8 rounded-lg border border-violet-800 bg-violet-950/20 p-5">
      <p className="text-xs font-black text-violet-300">引用候補収集タスク</p>
      <h2 className="mt-2 text-2xl font-black">引用候補を更新</h2>
      <StatusMessage message={message} />
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {tasks.map((task) => (
          <article key={task.id} className="rounded-lg bg-zinc-950 p-4">
            <p className="text-xs font-black text-violet-300">{task.sourceXHandle ? `@${task.sourceXHandle}` : "Xプロフィールあり"}</p>
            <h3 className="mt-2 text-lg font-black">{task.creatorName}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{task.productTitle}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{task.instruction}</p>
            <div className="mt-3 rounded-lg bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
              <p className="font-black text-white">収集済み {task.collectedCount}/20件</p>
              <p className="mt-1">使用予定: {task.plannedSlot}</p>
              <p className="mt-1">最終収集日: {task.lastCollectedAt?.slice(0, 10) ?? "未収集"} / 次回目安: {task.nextRefreshLabel}</p>
              <p className="mt-1">creator内Top score: {task.topScore ?? "-"}</p>
              <p className="mt-1">全体rank: {task.globalRank ?? "-"} / 今日採用: {task.selectedForToday ? "予定あり" : "なし"}</p>
              {task.topCandidates.length ? (
                <>
                  {task.topCandidates.map((candidate) => (
                    <div key={candidate.xPostUrl} className="mt-2 rounded-md bg-zinc-950 p-2">
                      <p className="font-black text-emerald-300">Top{candidate.rank} Score {candidate.score}</p>
                      <p className="mt-1 text-zinc-300">media: {candidate.mediaType} / visual: {candidate.quoteVisualReady ? "ready" : "fallback"} / URL: {candidate.urlKind}</p>
                      <p className="mt-1 text-zinc-400">{candidate.reason}</p>
                      <a href={candidate.quoteUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-cyan-300 underline">使用URL</a>
                      {candidate.quoteUrl !== candidate.xPostUrl && <a href={candidate.xPostUrl} target="_blank" rel="noreferrer" className="ml-3 mt-1 inline-flex text-zinc-400 underline">status URL</a>}
                    </div>
                  ))}
                </>
              ) : (
                <p className="mt-2 text-amber-200">creator内Top1-3はまだ作れていません。候補不足、未収集、または閾値未満です。</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`${task.creatorXUrl}${task.creatorXUrl.includes("?") ? "&" : "?"}myfans_creator_id=${task.creatorId ?? ""}${task.productId ? `&myfans_product_id=${task.productId}` : ""}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-700 px-3 text-xs font-black text-white">
                <ExternalLink size={15} /> Xプロフィールを開く
              </a>
              <span className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-3 text-xs font-black text-zinc-300">Companionで引用候補を収集</span>
            </div>
            <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <summary className="cursor-pointer text-xs font-black text-zinc-500">管理者用fallback</summary>
              <form onSubmit={(event) => { event.preventDefault(); if (task.productId) submit(task.productId, event.currentTarget); }} className="mt-3 grid gap-2">
                <input name="quote_candidate_x_url" type="url" required placeholder="https://x.com/.../status/..." className={inputClass} />
                <button type="submit" disabled={!task.productId || pendingId === task.productId} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 text-xs font-black text-white disabled:opacity-50">
                  <Save size={15} /> URLを直接登録
                </button>
              </form>
            </details>
          </article>
        ))}
        {!tasks.length && <p className="text-sm text-zinc-500">creator X URLがあり、引用候補URLが空の商品はありません。</p>}
      </div>
    </section>
  );
}

export function AffiliatePasteImportForm() {
  const { pending, message, submit } = useMyfansSubmit("myfans画面コピーから商品候補を登録しました。");

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-amber-800/60 bg-zinc-950/80 p-4">
      <input type="hidden" name="action" value="affiliate_text_import" />
      <div className="flex flex-wrap gap-3">
        <a
          href="https://www.affiliate.myfans.jp/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-400 px-5 text-sm font-black text-amber-100 transition hover:bg-amber-950/40 disabled:cursor-wait disabled:opacity-60"
        >
          <ExternalLink size={17} />
          myfans管理画面を開く
        </a>
        <SubmitButton pending={pending} label="貼り付け内容から候補登録" />
      </div>
      <Field label="myfans管理画面からコピーした内容">
        <textarea
          name="affiliate_text"
          required
          className={`${textareaClass} min-h-36`}
          placeholder="クリエイター詳細、商品詳細、または最近生成したURLの表示内容をここに貼り付け"
        />
      </Field>
      <div className="mt-3"><StatusMessage message={message} /></div>
      <p className="mt-2 text-xs leading-5 text-amber-100/70">
        通常のChromeでmyfansにログイン済みの画面を使います。ログイン突破、パスワード保存、X API投稿は行いません。
      </p>
    </form>
  );
}

export function QuickProductForm({ approvedMediaId }: { approvedMediaId?: number | null }) {
  const { pending, message, submit } = useMyfansSubmit("商品候補を保存しました。");

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-amber-800/60 bg-zinc-950/80 p-4 lg:grid-cols-3">
      <input type="hidden" name="action" value="product" />
      <input type="hidden" name="status" value="candidate" />
      <input type="hidden" name="approved_media_id" value={approvedMediaId ?? ""} />
      <Field label="商品名"><input name="title" required className={inputClass} /></Field>
      <Field label="商品URL"><input name="product_url" type="url" className={inputClass} /></Field>
      <Field label="アフィリンク"><input name="affiliate_url" type="url" className={inputClass} /></Field>
      <Field label="ジャンル"><input name="genre" className={inputClass} /></Field>
      <Field label="価格"><input name="price" type="number" min="0" className={inputClass} /></Field>
      <Field label="報酬率 %"><input name="reward_rate" type="number" min="0" step="0.01" className={inputClass} /></Field>
      <Field label="引用元X URL"><input name="source_x_url" type="url" className={inputClass} /></Field>
      <Field label="いいね"><input name="likes_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="保存"><input name="saves_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="選定理由"><textarea name="selection_reason" className={`${textareaClass} lg:col-span-3`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
        <SubmitButton pending={pending} label="商品候補を追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function ClickForm({ products, posts, approvedMediaId }: { products: MyfansProduct[]; posts: MyfansXPost[]; approvedMediaId?: number | null }) {
  const { pending, message, submit } = useMyfansSubmit("クリック実績を追加しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-4">
      <input type="hidden" name="action" value="click" />
      <input type="hidden" name="approved_media_id" value={approvedMediaId ?? ""} />
      <Field label="商品"><select name="product_id" className={inputClass}><option value="">未選択</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></Field>
      <Field label="投稿"><select name="x_post_id" className={inputClass}><option value="">未選択</option>{posts.map((post) => <option key={post.id} value={post.id}>{post.body.slice(0, 40)}</option>)}</select></Field>
      <Field label="日時"><input name="clicked_at" type="datetime-local" className={inputClass} /></Field>
      <Field label="配置"><select name="placement" className={inputClass}><option value="self_reply">自己リプ</option><option value="body">本文</option><option value="fixed_post">固定投稿</option><option value="profile">プロフィール</option><option value="manual">手動</option><option value="other">その他</option></select></Field>
      <Field label="メモ"><input name="note" className={inputClass} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-4">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 text-sm font-black text-white transition hover:bg-cyan-500 disabled:cursor-wait disabled:opacity-60">
          {pending ? <LoaderCircle size={17} className="animate-spin" /> : <MousePointerClick size={17} />}
          クリックを追加
        </button>
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function RevenueImportForm({ approvedMediaId }: { approvedMediaId?: number | null }) {
  const { pending, message, submit } = useMyfansSubmit("CSVを取り込みました。");
  const month = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date()).slice(0, 7);
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-[10rem_minmax(0,1fr)_auto]">
      <input type="hidden" name="action" value="revenue_import" />
      <input type="hidden" name="approved_media_id" value={approvedMediaId ?? ""} />
      <Field label="対象月"><input type="month" name="reportMonth" defaultValue={month} required className={inputClass} /></Field>
      <Field label="myfansレポートCSV"><input type="file" name="file" accept=".csv,text/csv" required className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:border-0 file:bg-transparent file:font-bold file:text-emerald-400" /></Field>
      <button type="submit" disabled={pending} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60">
        {pending ? <LoaderCircle size={17} className="animate-spin" /> : <FileUp size={17} />}
        CSV取込
      </button>
      <div className="lg:col-span-3"><StatusMessage message={message} /></div>
    </form>
  );
}

export function XMetricsSyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function sync() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/myfans/x-metrics-sync", { method: "POST" });
      const payload = (await response.json()) as { error?: string; message?: string; checked?: number; updated?: number; failed?: number };
      if (!response.ok) throw new Error(payload.error ?? "同期に失敗しました。");
      setMessage({
        text: payload.message ?? `確認${payload.checked ?? 0}件、更新${payload.updated ?? 0}件、失敗${payload.failed ?? 0}件`,
        error: false,
      });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "同期に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 text-sm font-black text-white transition hover:bg-cyan-500 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
        {pending ? "同期中" : "X投稿成績を同期"}
      </button>
      <StatusMessage message={message} />
    </div>
  );
}

export function BulkProductGuide() {
  const { pending, message, submit } = useMyfansSubmit("商品CSVを取り込みました。");
  return (
    <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm leading-7 text-zinc-300">
      <div className="flex items-center gap-2 font-black text-white"><Plus size={17} /> 初期20〜30件の登録導線</div>
      <p className="mt-2 text-zinc-400">CSVヘッダーは title, product_url, affiliate_url, source_x_url, genre, price, reward_rate, likes_count, saves_count, selection_reason が使えます。日本語ヘッダーも一部対応しています。</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="action" value="product_import" />
        <Field label="商品CSV"><input type="file" name="file" accept=".csv,text/csv" required className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:border-0 file:bg-transparent file:font-bold file:text-emerald-400" /></Field>
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60">
          {pending ? <LoaderCircle size={17} className="animate-spin" /> : <FileUp size={17} />}
          一括登録
        </button>
        <StatusMessage message={message} />
      </form>
    </section>
  );
}
