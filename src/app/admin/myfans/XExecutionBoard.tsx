"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { buildMyfansExecutionBoard } from "@/lib/myfansXExecution";
import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";
import type { MyfansXPost } from "@/lib/myfansAnalytics";
import { MYFANS_AFFILIATE_URL_SOURCE_MANUAL, normalizeMyfansAffiliateUrl } from "@/lib/myfansAffiliateLink";
import { candidateSaveBlockReason } from "@/lib/myfansCandidateSave";
import type { Message } from "./MyfansFormPrimitives";
import { StatusMessage } from "./MyfansFormPrimitives";
import { postFormData } from "./myfansFormApi";
import { XExecutionPostMetrics } from "./XExecutionPostMetrics";
import { MyfansCandidateOption } from "./MyfansCandidateOption";
import { MyfansExecutionCandidateCard } from "./MyfansExecutionCandidateCard";
import { buildExecutionCandidateFormData } from "./myfansExecutionCandidateForm";
import {
  canUseAffiliateLink,
  dedupePostedPosts,
  isMetricsRecorded,
  needsFreshAffiliateLink,
  quoteIntentUrl,
} from "./MyfansExecutionBoardRules";
type CandidateOptionSlot = ReturnType<typeof buildMyfansExecutionBoard>["candidateOptions"][number];
type CandidateOption = CandidateOptionSlot["candidates"][number];

export function XExecutionBoard({ candidates, candidateOptions, selectedOptions, planDate, posts, emptyStateFallback }: { candidates: ExecutionCandidate[]; candidateOptions?: CandidateOptionSlot[]; selectedOptions?: Record<string, string>; planDate: string; posts: MyfansXPost[]; emptyStateFallback: ReactNode }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pendingId, setPendingId] = useState<string | number | null>(null);
  const [hiddenCandidateIds, setHiddenCandidateIds] = useState<Set<string>>(() => new Set());
  const [savedCandidateIds, setSavedCandidateIds] = useState<Set<string>>(() => new Set());
  const [selectedBySlot, setSelectedBySlot] = useState<Record<number, string>>(() =>
    Object.fromEntries((candidateOptions ?? []).map((slot) => {
      const selectedLabel = selectedOptions?.[String(slot.postOrder)] ?? "";
      return [slot.postOrder, selectedLabel ? slot.candidates.find((candidate) => candidate.optionLabel === selectedLabel)?.id ?? "" : ""];
    })),
  );

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage({ text: `${label}をコピーしました。`, error: false });
  }

  async function createCandidate(candidate: ExecutionCandidate) {
    if (savedCandidateIds.has(candidate.id)) return;
    const saveBlockReason = candidateSaveBlockReason(candidate);
    if (saveBlockReason) {
      setMessage({ text: saveBlockReason, error: true });
      return;
    }
    setPendingId(candidate.id);
    setMessage(null);
    try {
      await postFormData(buildExecutionCandidateFormData(candidate));
      setSavedCandidateIds((current) => new Set(current).add(candidate.id));
      setMessage({ text: "候補を投稿ログに保存しました。", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "保存に失敗しました。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  async function selectCandidate(slot: CandidateOptionSlot, candidate: CandidateOption) {
    setPendingId(`select-${slot.postOrder}-${candidate.optionLabel}`);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("action", "daily_plan_select");
      formData.set("approved_media_id", String(candidate.approvedMediaId ?? ""));
      formData.set("plan_date", planDate);
      if (candidate.approvedMediaId) formData.set("approved_media_id", String(candidate.approvedMediaId));
      formData.set("post_order", String(slot.postOrder));
      formData.set("option_label", candidate.optionLabel);
      await postFormData(formData);
      setSelectedBySlot((current) => ({ ...current, [slot.postOrder]: candidate.id }));
      setMessage({ text: `Slot${slot.postOrder}は候補${candidate.optionLabel}を選択済みにしました。`, error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "候補選択を保存できませんでした。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  async function skipCandidate(candidate: CandidateOption) {
    const targetLabel = "この候補を今後表示しない";
    if (!window.confirm(`${targetLabel}設定にします。日付が変わっても3×4候補へ戻りません。実行しますか？`)) return;
    setPendingId(`skip-${candidate.id}`);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("action", "permanent_candidate_skip");
      formData.set("candidate_id", candidate.id);
      if (candidate.approvedMediaId) formData.set("approved_media_id", String(candidate.approvedMediaId));
      formData.set("plan_date", planDate);
      if (candidate.product?.id) formData.set("product_id", String(candidate.product.id));
      if (candidate.quoteCandidateId) formData.set("quote_candidate_id", String(candidate.quoteCandidateId));
      formData.set("quote_x_url", candidate.quoteXUrl);
      formData.set("source_x_url", candidate.sourceXUrl);
      await postFormData(formData);
      setHiddenCandidateIds((current) => new Set(current).add(candidate.id));
      setMessage({ text: `${targetLabel}にしました。`, error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "候補を恒久除外できませんでした。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  async function saveAffiliateLink(candidate: ExecutionCandidate, form: HTMLFormElement) {
    if (!candidate.product) return;
    setPendingId(`affiliate-${candidate.product.id}`);
    setMessage(null);
    try {
      const formData = new FormData(form);
      const affiliateUrl = normalizeMyfansAffiliateUrl(String(formData.get("affiliate_url") ?? ""));
      if (!affiliateUrl) throw new Error("正規のmyfansアフィリンク（https://mfco.link/r/...）だけ保存できます。");
      formData.set("action", "affiliate_link_update");
      formData.set("product_id", String(candidate.product.id));
      formData.set("affiliate_url", affiliateUrl);
      formData.set("affiliate_url_generated_at", new Date().toISOString());
      formData.set("affiliate_url_source", MYFANS_AFFILIATE_URL_SOURCE_MANUAL);
      await postFormData(formData);
      setMessage({ text: "アフィリンクを保存しました。自己リプ文も新しいリンクで更新されます。", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "アフィリンクを保存できませんでした。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  const selectedCandidates = (candidateOptions ?? [])
    .map((slot) => slot.candidates.find((candidate) => !hiddenCandidateIds.has(candidate.id) && selectedBySlot[slot.postOrder] === candidate.id))
    .filter((candidate): candidate is CandidateOption => Boolean(candidate));
  const executionCandidates = selectedCandidates.length ? selectedCandidates : candidates;

  async function launchTodayCandidates() {
    const activeCandidates = executionCandidates.filter((candidate) => candidate.product);
    if (!activeCandidates.length || pendingId) return;
    const blocked = activeCandidates.filter((candidate) => needsFreshAffiliateLink(candidate) && !canUseAffiliateLink(candidate));
    if (blocked.length) {
      setMessage({ text: "リンクが必要な投稿に未作成/期限切れがあります。先にアフィリンクを作成/更新してください。", error: true });
      return;
    }
    setPendingId("today");
    setMessage(null);
    const draftWindows = activeCandidates.map(() => {
      const draftWindow = window.open("about:blank", "_blank");
      if (draftWindow) draftWindow.opener = null;
      return draftWindow;
    });
    try {
      for (const candidate of activeCandidates) {
        await createCandidate(candidate);
      }
      activeCandidates.forEach((candidate, index) => {
        window.setTimeout(() => {
          const url = quoteIntentUrl(candidate);
          const draftWindow = draftWindows[index];
          if (draftWindow) draftWindow.location.href = url;
          else window.open(url, "_blank", "noopener,noreferrer");
        }, index * 350);
      });
      setMessage({ text: "今日の投稿をXで開きました。リンク付きだけで並べず、ローテーション通りに開いています。", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "今日の投稿を開けませんでした。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  async function updatePost(post: MyfansXPost, mode: "posted" | "url" | "metrics", form?: HTMLFormElement) {
    setPendingId(post.id);
    setMessage(null);
    try {
      const formData = new FormData(form);
      formData.set("action", "post_execution_update");
      formData.set("id", String(post.id));
      formData.set("mode", mode);
      await postFormData(formData);
      setMessage({ text: "投稿ログを更新しました。", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "更新に失敗しました。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  const confirmedPosts = dedupePostedPosts(posts);
  const postedPosts = confirmedPosts.filter((post) => !isMetricsRecorded(post)).slice(0, 12);
  const recordedPosts = confirmedPosts.filter(isMetricsRecorded).slice(0, 5);
  return (
    <div className="mt-8 space-y-6">
      <StatusMessage message={message} />
      {!executionCandidates.some((candidate) => candidate.product) && (
        <section className="rounded-xl border border-amber-800 bg-amber-950/30 p-5">
          <p className="text-sm font-black text-amber-200">投稿前に商品候補が必要です</p>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            この画面は選択中の運用メディアに紐づく商品から投稿文を作ります。引用元Xは引用投稿用として扱い、再アップロード用素材とは分けて表示します。myfans管理画面の商品詳細や最近生成したURLをコピーして貼ると、候補登録後に今日の投稿案が生成されます。
          </p>
          {emptyStateFallback}
        </section>
      )}
      <section className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black text-emerald-300">今日の実行</p>
            <h2 className="mt-2 text-xl font-black">今日の投稿を、役割つきで順番に出す</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              すべてリンク付きにはしません。露出、プロフィール誘導、リンクテストを分けて、どこで詰まっているか見えるようにします。
            </p>
          </div>
          <button
            type="button"
            onClick={launchTodayCandidates}
            disabled={pendingId === "today" || !executionCandidates.some((candidate) => candidate.product)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-black text-black transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            <ExternalLink size={17} />
            今日の投稿をXで開く
          </button>
        </div>
      </section>
      {candidateOptions?.length ? (
        <section className="grid gap-5">
          {candidateOptions.map((slot) => (
            <article key={`${slot.slot}-${slot.postOrder}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black text-emerald-300">Slot{slot.postOrder} / {slot.slot}</p>
                  <h2 className="mt-1 text-xl font-black">候補A/B/Cから1つ選ぶ</h2>
                </div>
                <p className="text-xs font-black text-zinc-400">システム推奨: 候補A（おすすめ）</p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {slot.candidates.filter((candidate) => !hiddenCandidateIds.has(candidate.id)).map((candidate) => {
                  const selected = selectedBySlot[slot.postOrder] === candidate.id;
                  return (
                    <MyfansCandidateOption
                      key={candidate.id}
                      candidate={candidate}
                      slot={slot}
                      selected={selected}
                      pendingId={pendingId}
                      saved={savedCandidateIds.has(candidate.id)}
                      saveBlockReason={candidateSaveBlockReason(candidate)}
                      onCopy={copy}
                      onSelect={selectCandidate}
                      onSkip={skipCandidate}
                      onSave={createCandidate}
                    />
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-3">
        {executionCandidates.map((candidate) => (
          <MyfansExecutionCandidateCard
            key={candidate.id}
            candidate={candidate}
            pendingId={pendingId}
            saved={savedCandidateIds.has(candidate.id)}
            onCopy={copy}
            onSaveCandidate={createCandidate}
            onSaveAffiliateLink={saveAffiliateLink}
            onMessage={setMessage}
          />
        ))}
      </section>
      <XExecutionPostMetrics
        postedPosts={postedPosts}
        recordedPosts={recordedPosts}
        pendingId={pendingId}
        onUpdatePost={updatePost}
      />
    </div>
  );
}


