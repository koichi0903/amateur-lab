"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Channel = {
  key: string;
  label: string;
  appConfigured: boolean;
  missingAppKeys: string[];
  connected: boolean;
  accountLabel: string | null;
  channelId: string | null;
  enabled: boolean;
  missingScopes: string[];
  canConnect: boolean;
};

type Status = {
  channels: Channel[];
  schemaReady: boolean;
  tokenEncryptionConfigured: boolean;
  privateMediaBucketVerified: boolean;
  databaseError: string | null;
  publicPostingGate: boolean;
  workerEnabled: boolean;
};

type ReviewJob = {
  id: string;
  content_kind: "video" | "image" | "text";
  caption: string;
  youtube_privacy_status?: "public" | "unlisted" | "private" | null;
  scheduled_at: string;
  status: string;
  content_revision: number;
  review_status: string;
  review_attested: boolean;
  previewUrl: string | null;
  previewError?: string;
  source_work_id?: number | null;
  source_catalog_content_id?: string | null;
  source_maker?: string | null;
  source_usage_attested?: boolean;
  source_usage_checked_at?: string | null;
  source_sample_host?: string | null;
  trim_start_seconds?: number | null;
  trim_end_seconds?: number | null;
  published_at?: string | null;
  provider_request_id?: string | null;
  provider_post_id?: string | null;
  last_error_code?: string | null;
  channel: { platform: string; account_label: string } | null;
};

type SampleCandidate = {
  key: string;
  id: number | null;
  sourceWorkId: number | null;
  sourceCatalogContentId: string | null;
  productId: string | null;
  title: string;
  maker: string | null;
  price: number | null;
  salePrice: number | null;
  discountRate: number | null;
  ranking: number | null;
  rankingScore: number | null;
  reviewAverage: number | null;
  reviewCount: number | null;
  releaseDate: string | null;
  imageUrl: string | null;
  sampleMovieUrl: string;
  isOnSale: boolean | null;
  saleEndAt: string | null;
  usedChannelIds: string[];
};

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export default function SocialAutoPublishPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyChannel, setBusyChannel] = useState<string | null>(null);
  const [reviewJobs, setReviewJobs] = useState<ReviewJob[]>([]);
  const [recentJobs, setRecentJobs] = useState<ReviewJob[]>([]);
  const [sampleCandidates, setSampleCandidates] = useState<SampleCandidate[]>([]);
  const [catalogSampleCandidates, setCatalogSampleCandidates] = useState<SampleCandidate[]>([]);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [catalogSampleQuery, setCatalogSampleQuery] = useState("");
  const [catalogCandidateError, setCatalogCandidateError] = useState<string | null>(null);
  const [searchingCatalogCandidates, setSearchingCatalogCandidates] = useState(false);
  const [selectedSampleKey, setSelectedSampleKey] = useState("");
  const [sampleTrimStart, setSampleTrimStart] = useState("0");
  const [sampleTrimEnd, setSampleTrimEnd] = useState("15");
  const [sampleChannelId, setSampleChannelId] = useState("");
  const [sampleCaption, setSampleCaption] = useState("");
  const [sampleSchedule, setSampleSchedule] = useState("");
  const [sampleYoutubePrivacy, setSampleYoutubePrivacy] = useState<"" | "public" | "unlisted" | "private">("");
  const [preparingSample, setPreparingSample] = useState(false);
  const [reviewChecks, setReviewChecks] = useState<Record<string, boolean>>({});
  const [sourceUsageChecks, setSourceUsageChecks] = useState<Record<string, boolean>>({});
  const [busyReview, setBusyReview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [draftChannelId, setDraftChannelId] = useState("");
  const [draftCaption, setDraftCaption] = useState("");
  const [draftSchedule, setDraftSchedule] = useState("");
  const [draftYoutubePrivacy, setDraftYoutubePrivacy] = useState<"" | "public" | "unlisted" | "private">("");
  const [preparingDraft, setPreparingDraft] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/social-publishing/status", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "状態を取得できませんでした。");
      setStatus(payload as Status);
      const queueResponse = await fetch("/api/admin/social-publishing/jobs", { cache: "no-store" });
      const queuePayload = await queueResponse.json();
      if (!queueResponse.ok) throw new Error(queuePayload.error ?? "投稿確認キューを取得できませんでした。");
      const jobs = (queuePayload.jobs ?? []) as ReviewJob[];
      setReviewJobs(jobs.filter((job) => job.status === "awaiting_user_review"));
      setRecentJobs(jobs.filter((job) => job.status !== "awaiting_user_review").slice(0, 10));
      try {
        const candidatesResponse = await fetch("/api/admin/social-publishing/jobs?view=sample-candidates", { cache: "no-store" });
        const candidatesPayload = await candidatesResponse.json();
        if (!candidatesResponse.ok) throw new Error(candidatesPayload.error ?? "公式サンプル候補を取得できませんでした。");
        setSampleCandidates((candidatesPayload.candidates ?? []) as SampleCandidate[]);
        setCandidateError(null);
      } catch (cause) {
        setCandidateError(cause instanceof Error ? cause.message : "公式サンプル候補を取得できませんでした。");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状態を取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const readyForConnect = Boolean(status?.schemaReady && status.tokenEncryptionConfigured);
  const publishableChannels = (status?.channels ?? []).filter((channel) => status?.privateMediaBucketVerified && channel.connected && channel.enabled && channel.missingScopes.length === 0 && channel.channelId);
  const allSampleCandidates = [...sampleCandidates, ...catalogSampleCandidates];

  const searchCatalogSampleCandidates = async () => {
    const query = catalogSampleQuery.trim();
    setSearchingCatalogCandidates(true);
    setCatalogCandidateError(null);
    try {
      const response = await fetch(`/api/admin/social-publishing/jobs?view=sample-candidates&q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "APIカタログを検索できませんでした。");
      const candidates = (payload.candidates ?? []) as SampleCandidate[];
      setCatalogSampleCandidates(candidates);
      if (candidates.length === 0) setCatalogCandidateError("公式動画を取得済みの作品は見つかりませんでした。");
      if (selectedSampleKey.startsWith("catalog:")) setSelectedSampleKey("");
    } catch (cause) {
      setCatalogSampleCandidates([]);
      setCatalogCandidateError(cause instanceof Error ? cause.message : "APIカタログを検索できませんでした。");
    } finally {
      setSearchingCatalogCandidates(false);
    }
  };

  const prepareDraft = async () => {
    if (!mediaFile || !draftChannelId || !draftCaption.trim() || !draftSchedule) return;
    const selectedChannel = publishableChannels.find((channel) => channel.channelId === draftChannelId);
    if (!selectedChannel) {
      setError("接続済み・有効な投稿先を選択してください。");
      return;
    }
    if (selectedChannel.key === "youtube_shorts" && !draftYoutubePrivacy) {
      setError("YouTubeの公開範囲を選択してください。");
      return;
    }
    if (selectedChannel.key === "youtube_shorts" && utf8Bytes(draftCaption) > 5000) {
      setError("YouTubeの説明欄はUTF-8で5,000バイト以内にしてください。");
      return;
    }
    setPreparingDraft(true);
    setError(null);
    try {
      const urlResponse = await fetch("/api/admin/social-publishing/media-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: mediaFile.type, size: mediaFile.size }),
      });
      const upload = await urlResponse.json();
      if (!urlResponse.ok) throw new Error(upload.error ?? "動画保存の準備に失敗しました。");
      const { error: uploadError } = await supabase.storage.from(upload.bucket).uploadToSignedUrl(
        upload.storageKey,
        upload.token,
        mediaFile,
        { contentType: "video/mp4", upsert: false },
      );
      if (uploadError) throw new Error("非公開ストレージへのアップロードに失敗しました。");
      const postResponse = await fetch("/api/admin/social-publishing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: draftChannelId,
          idempotencyKey: `admin:${selectedChannel.key}:${crypto.randomUUID()}`,
          contentKind: "video",
          caption: draftCaption.trim(),
          youtubePrivacyStatus: selectedChannel.key === "youtube_shorts" ? draftYoutubePrivacy : null,
          mediaStorageKey: upload.storageKey,
          scheduledAt: new Date(draftSchedule).toISOString(),
        }),
      });
      const result = await postResponse.json();
      if (!postResponse.ok) throw new Error(result.error ?? "確認待ちキューへの登録に失敗しました。");
      setMediaFile(null);
      setDraftCaption("");
      setDraftSchedule("");
      setDraftYoutubePrivacy("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "確認待ちキューへの登録に失敗しました。");
    } finally {
      setPreparingDraft(false);
    }
  };

  const prepareSampleDraft = async () => {
    const selected = allSampleCandidates.find((candidate) => candidate.key === selectedSampleKey);
    const start = Number(sampleTrimStart);
    const end = Number(sampleTrimEnd);
    const selectedChannel = publishableChannels.find((channel) => channel.channelId === sampleChannelId);
    if (!selected || !selectedChannel || !sampleCaption.trim() || !sampleSchedule) return;
    if (selectedChannel?.key === "youtube_shorts" && !sampleYoutubePrivacy) {
      setError("YouTubeの公開範囲を選択してください。");
      return;
    }
    if (selectedChannel?.key === "youtube_shorts" && utf8Bytes(sampleCaption) > 5000) {
      setError("YouTubeの説明欄はUTF-8で5,000バイト以内にしてください。");
      return;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 60) {
      setError("切り抜き範囲は開始0秒以上、長さ60秒以内で指定してください。");
      return;
    }
    setPreparingSample(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/social-publishing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: sampleChannelId,
          idempotencyKey: `sample:${selectedChannel.key}:${crypto.randomUUID()}`,
          contentKind: "video",
          caption: sampleCaption.trim(),
          youtubePrivacyStatus: selectedChannel.key === "youtube_shorts" ? sampleYoutubePrivacy : null,
          scheduledAt: new Date(sampleSchedule).toISOString(),
          ...(selected.sourceWorkId !== null ? { sourceWorkId: selected.sourceWorkId } : { sourceCatalogContentId: selected.sourceCatalogContentId }),
          trimStartSeconds: start,
          trimEndSeconds: end,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "サンプルの切り抜き・確認待ち登録に失敗しました。");
      setSampleCaption("");
      setSampleSchedule("");
      setSampleYoutubePrivacy("");
      setSelectedSampleKey("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "サンプルの切り抜き・確認待ち登録に失敗しました。");
    } finally {
      setPreparingSample(false);
    }
  };

  const enableChannel = async (channel: Channel) => {
    if (!channel.channelId) return;
    setBusyChannel(channel.channelId);
    setError(null);
    try {
      const response = await fetch("/api/admin/social-publishing/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: channel.channelId, enabled: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "チャンネルを有効化できませんでした。");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "チャンネルを有効化できませんでした。");
    } finally {
      setBusyChannel(null);
    }
  };

  const decideReview = async (job: ReviewJob, decision: "approve" | "reject") => {
    if (decision === "approve" && !reviewChecks[job.id]) return;
    if (decision === "approve" && (job.source_work_id || job.source_catalog_content_id) && !sourceUsageChecks[job.id]) return;
    setBusyReview(job.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/social-publishing/jobs/${job.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, contentRevision: job.content_revision, reviewAttested: decision === "approve" && Boolean(reviewChecks[job.id]), sourceUsageAttested: decision === "approve" && Boolean(sourceUsageChecks[job.id]) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "投稿判断を保存できませんでした。");
      setReviewChecks((current) => ({ ...current, [job.id]: false }));
      setSourceUsageChecks((current) => ({ ...current, [job.id]: false }));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "投稿判断を保存できませんでした。");
    } finally {
      setBusyReview(null);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-violet-800 bg-violet-950/20 p-5" aria-labelledby="social-auto-publish-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-violet-300">CROSS-CHANNEL PUBLISHING</p>
          <h2 id="social-auto-publish-title" className="mt-1 text-xl font-black">複数SNSの自動投稿</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100/75">
            YouTube Shorts・Instagram Reels・Threadsの自動投稿を準備します。投稿ごとに素材・本文・投稿先・公開時刻を目視確認して承認したものだけを予約します。TikTokは運用対象から廃止しました。
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-700 px-3 text-xs font-bold text-violet-100 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 状態を再取得
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {status && !status.privateMediaBucketVerified && <p role="status" className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">素材保存先が未設定、または非公開であることを確認できません。素材の表示・チャンネル有効化・自動配信は停止します。</p>}
      {status?.databaseError && <p role="status" className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">投稿キューDBをまだ読めません。Migration未適用、またはサーバーDB接続未設定の可能性があります。詳細: {status.databaseError}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(status?.channels ?? [
          { key: "youtube_shorts", label: "YouTube Shorts", appConfigured: false, missingAppKeys: [], connected: false, accountLabel: null, channelId: null, enabled: false, missingScopes: [], canConnect: false },
          { key: "instagram_reels", label: "Instagram Reels", appConfigured: false, missingAppKeys: [], connected: false, accountLabel: null, channelId: null, enabled: false, missingScopes: [], canConnect: false },
          { key: "threads", label: "Threads", appConfigured: false, missingAppKeys: [], connected: false, accountLabel: null, channelId: null, enabled: false, missingScopes: [], canConnect: false },
        ]).map((channel) => {
          const scopesConfirmed = channel.missingScopes.length === 0;
          const active = Boolean(status?.privateMediaBucketVerified) && channel.connected && channel.enabled && scopesConfirmed;
          return (
            <article key={channel.key} className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black text-white">{channel.label}</h3>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${active ? "border-emerald-700 text-emerald-200" : "border-amber-700 text-amber-200"}`}>
                  {active ? "自動投稿ON" : channel.connected && !scopesConfirmed ? "投稿権限未確認・停止" : channel.connected ? "接続済み・停止中" : "未接続"}
                </span>
              </div>
              {channel.accountLabel && <p className="mt-2 text-xs text-zinc-300">接続先: {channel.accountLabel}</p>}
                {channel.connected && channel.missingScopes.length > 0 && <p className="mt-2 text-xs leading-5 text-amber-200">投稿権限を確認できていません。OAuthの実許可スコープが不足しているか、プロバイダーが返していません。不足: {channel.missingScopes.join(", ")}</p>}
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                {channel.appConfigured ? "APIアプリ設定を検出。" : "APIアプリ設定が未完了。"}
              </p>
              {!channel.connected && channel.missingAppKeys.length > 0 && (
                <p className="mt-2 break-words text-[10px] leading-4 text-zinc-500">必要なサーバー設定: {channel.missingAppKeys.join(", ")}</p>
              )}
              {channel.canConnect && (!channel.connected || !scopesConfirmed) && <a href={`/api/admin/social-publishing/oauth/${channel.key}`} className="mt-3 inline-flex rounded-md bg-violet-500 px-3 py-2 text-xs font-black text-white hover:bg-violet-400">{channel.connected ? "投稿権限を再確認するため再接続" : "公式アカウントを接続"}</a>}
              {channel.connected && !channel.enabled && channel.missingScopes.length === 0 && <button type="button" onClick={() => void enableChannel(channel)} disabled={busyChannel === channel.channelId} className="mt-3 rounded-md bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50">{busyChannel === channel.channelId ? "更新中…" : "自動投稿を有効化"}</button>}
            </article>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 rounded-lg border border-violet-900/70 bg-zinc-950/70 p-4 text-xs leading-5 text-violet-100/80 md:grid-cols-3">
        <p className="flex gap-2"><CircleHelp className="mt-0.5 shrink-0 text-violet-300" size={14} />初回だけ、各公式アプリの登録と対象アカウントのOAuth許可が必要です。</p>
        <p className="flex gap-2"><AlertCircle className="mt-0.5 shrink-0 text-amber-300" size={14} />現在は接続・配信機能の準備段階です。画面表示だけで自動投稿が有効になったとは扱いません。</p>
        <p className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={14} />素材利用条件と各SNSの掲載可否は、投稿API接続とは別の確認項目です。</p>
      </div>
      {!status?.workerEnabled && <p className="mt-3 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs font-bold text-amber-100">予約配信Workerは停止中です。投稿の確認・承認はできますが、自動配信は実行されません。</p>}
      {!readyForConnect && <p className="mt-3 text-[11px] text-zinc-500">OAuth接続ボタンは、トークン暗号化キーと投稿キューの導入を確認してから有効にします。</p>}

      <div className="mt-6 border-t border-violet-900/70 pt-5">
        <h3 className="text-base font-black text-white">作品候補から公式サンプルを切り抜く</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-400">登録済み作品または素人作品APIカタログから公式サンプルを選び、指定区間を非公開保存します。候補表示は素材の利用許可を意味しません。切り抜き後の動画を公開前確認で必ず再生してください。</p>
        {candidateError && <p role="status" className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-100">候補一覧: {candidateError}</p>}
        <div className="mt-3 grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-xs font-bold text-zinc-300">素人作品APIカタログを品番で検索
              <input value={catalogSampleQuery} onChange={(event) => setCatalogSampleQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCatalogSampleCandidates(); } }} placeholder="例: hsg010" maxLength={120} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm font-normal text-white" />
            </label>
            <button type="button" disabled={searchingCatalogCandidates || catalogSampleQuery.trim().length < 3} onClick={() => void searchCatalogSampleCandidates()} className="rounded-md border border-violet-700 px-3 py-2 text-xs font-bold text-violet-100 disabled:opacity-40">{searchingCatalogCandidates ? "検索中…" : "品番検索"}</button>
          </div>
          {catalogCandidateError && <p role="status" className="rounded-md border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-100">APIカタログ: {catalogCandidateError}</p>}
          {allSampleCandidates.length === 0 ? <p className="text-xs text-zinc-500">公式サンプル動画付きの候補がありません。品番検索を試してください。</p> : (
            <label className="text-xs font-bold text-zinc-300">作品候補（メーカー・利用条件は公開前に要確認）
              <select value={selectedSampleKey} onChange={(event) => setSelectedSampleKey(event.target.value)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white">
                <option value="">選択してください</option>
                {allSampleCandidates.map((candidate) => {
                  const usedOnSelectedChannel = Boolean(sampleChannelId && candidate.usedChannelIds.includes(sampleChannelId));
                  return <option key={candidate.key} value={candidate.key} disabled={usedOnSelectedChannel}>{candidate.ranking ? `#${candidate.ranking} ` : ""}{candidate.title} / {candidate.productId ?? candidate.sourceCatalogContentId ?? `work ${candidate.sourceWorkId ?? "?"}`}{candidate.sourceCatalogContentId ? "（APIカタログ）" : ""}{usedOnSelectedChannel ? "（この投稿先で使用済み）" : ""}</option>;
                })}
              </select>
            </label>
          )}
          {allSampleCandidates.find((candidate) => candidate.key === selectedSampleKey) && (() => {
            const candidate = allSampleCandidates.find((item) => item.key === selectedSampleKey)!;
            return <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm font-black text-white">{candidate.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">品番: {candidate.productId ?? "未登録"} / メーカー: {candidate.maker ?? "未登録"} / {candidate.sourceCatalogContentId ? `APIカタログID: ${candidate.sourceCatalogContentId}` : `作品ID: ${candidate.sourceWorkId ?? "未登録"}`}</p>
                  <p className="mt-2 text-xs leading-5 text-amber-200">価格・ランキング・レビューのDB値: {candidate.salePrice ?? candidate.price ?? "未登録"}円{candidate.ranking ? ` / 保存順位 ${candidate.ranking}位` : ""}{candidate.reviewAverage != null ? ` / 評価 ${candidate.reviewAverage}` : ""}{candidate.reviewCount != null ? ` (${candidate.reviewCount}件)` : ""}. 公開文へ使う場合は公式ページで当日確認してください。</p>
                  <a className="mt-2 inline-block text-xs text-violet-300 underline" href={candidate.sampleMovieUrl} target="_blank" rel="noreferrer">公式サンプルを別タブで確認</a>
                </div>
                <video className="max-h-64 w-full rounded-md bg-black object-contain" src={candidate.sampleMovieUrl} controls playsInline preload="metadata" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold text-zinc-300">切り抜き開始秒<input type="number" min="0" step="0.1" value={sampleTrimStart} onChange={(event) => setSampleTrimStart(event.target.value)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs font-bold text-zinc-300">切り抜き終了秒（開始から60秒以内）<input type="number" min="0.1" step="0.1" value={sampleTrimEnd} onChange={(event) => setSampleTrimEnd(event.target.value)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs font-bold text-zinc-300">投稿先アカウント<select value={sampleChannelId} onChange={(event) => setSampleChannelId(event.target.value)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white"><option value="">選択してください</option>{publishableChannels.map((channel) => <option key={channel.channelId} value={channel.channelId!}>{channel.label} / {channel.accountLabel}</option>)}</select></label>
                <label className="text-xs font-bold text-zinc-300">公開予定<input type="datetime-local" value={sampleSchedule} onChange={(event) => setSampleSchedule(event.target.value)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white" /></label>
                {publishableChannels.find((channel) => channel.channelId === sampleChannelId)?.key === "youtube_shorts" && <div className="rounded-md border border-amber-800 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100 md:col-span-2"><label className="font-bold">YouTubeの公開範囲<select required value={sampleYoutubePrivacy} onChange={(event) => setSampleYoutubePrivacy(event.target.value as typeof sampleYoutubePrivacy)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white"><option value="">選択してください</option><option value="private">非公開</option><option value="unlisted">限定公開</option><option value="public">公開</option></select></label><p className="mt-2">予約時刻にアップロードします。「公開」はアップロード後に公開、「限定公開」はリンクを知る人が視聴できます。「非公開」はアップロード後も非公開のままで、予約時刻に自動公開されません。対象チャンネル・動画の公開範囲とYouTube API利用条件を確認してください。</p><a className="underline" href="https://developers.google.com/youtube/terms/api-services-terms-of-service" target="_blank" rel="noreferrer">YouTube API利用条件</a></div>}
                <label className="text-xs font-bold text-zinc-300 md:col-span-2">投稿文<textarea placeholder="映像・音声を確認してから、投稿先に合う本文を入力" value={sampleCaption} onChange={(event) => setSampleCaption(event.target.value)} maxLength={5000} rows={4} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm font-normal text-white" />{publishableChannels.find((channel) => channel.channelId === sampleChannelId)?.key === "youtube_shorts" && <span className={`mt-1 block text-[11px] ${utf8Bytes(sampleCaption) > 5000 ? "text-rose-300" : "text-zinc-500"}`}>YouTube説明欄: {utf8Bytes(sampleCaption)} / 5,000 UTF-8バイト</span>}</label>
              </div>
              <p className="text-[11px] leading-5 text-amber-200">サンプル表示や切り抜き機能は、素材利用許可・センシティブ判定・媒体適合の確認を代替しません。DMMはサンプル動画の切り抜き利用を一部メーカー等に限定し、利用可能一覧にないメーカーの利用を禁止しています。候補のメーカーを確認し、投稿前に公式条件と現行一覧を必ず確認してください。同じ投稿先で過去に使用した作品は選べません。</p>
              <p className="text-[11px] leading-5"><a className="text-violet-300 underline" href="https://support.dmm.com/affiliate/article/44123" target="_blank" rel="noreferrer">DMMのサンプル動画利用条件</a><span className="mx-2 text-zinc-500">/</span><a className="text-violet-300 underline" href="https://docs.google.com/forms/d/e/1FAIpQLSdH2qwHdfDrfwKKHbeV9wQYHYzYvjB30qkgJNAVUQY8z1VHRw/viewform" target="_blank" rel="noreferrer">現在の利用可能メーカー・レーベル一覧</a></p>
              <button type="button" disabled={preparingSample || !sampleChannelId || !sampleCaption.trim() || !sampleSchedule || (publishableChannels.find((channel) => channel.channelId === sampleChannelId)?.key === "youtube_shorts" && !sampleYoutubePrivacy)} onClick={() => void prepareSampleDraft()} className="justify-self-start rounded-md bg-violet-500 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{preparingSample ? "公式動画を切り抜き中…" : "切り抜いて公開前確認へ登録"}</button>
            </>;
          })()}
        </div>
      </div>

      <div className="mt-6 border-t border-violet-900/70 pt-5">
        <h3 className="text-base font-black text-white">動画を確認待ちに登録</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-400">MP4を非公開領域へ保存し、選んだアカウントの確認待ち投稿にします。投稿はこの画面で素材・本文・投稿先を確認して承認するまで配信されません。</p>
        <div className="mt-3 grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 md:grid-cols-2">
          <label className="text-xs font-bold text-zinc-300">MP4動画（最大64MB。サーバー設定で低くなる場合があります）
            <input type="file" accept="video/mp4,.mp4" onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs" />
          </label>
          <label className="text-xs font-bold text-zinc-300">投稿先アカウント
            <select value={draftChannelId} onChange={(event) => setDraftChannelId(event.target.value)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white">
              <option value="">選択してください</option>
              {publishableChannels.map((channel) => <option key={channel.channelId} value={channel.channelId!}>{channel.label} / {channel.accountLabel}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-zinc-300 md:col-span-2">投稿文
            <textarea value={draftCaption} onChange={(event) => setDraftCaption(event.target.value)} maxLength={5000} rows={4} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm font-normal text-white" />{publishableChannels.find((channel) => channel.channelId === draftChannelId)?.key === "youtube_shorts" && <span className={`mt-1 block text-[11px] ${utf8Bytes(draftCaption) > 5000 ? "text-rose-300" : "text-zinc-500"}`}>YouTube説明欄: {utf8Bytes(draftCaption)} / 5,000 UTF-8バイト</span>}
          </label>
          <label className="text-xs font-bold text-zinc-300">公開予定
            <input type="datetime-local" value={draftSchedule} onChange={(event) => setDraftSchedule(event.target.value)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white" />
          </label>
          {publishableChannels.find((channel) => channel.channelId === draftChannelId)?.key === "youtube_shorts" && <div className="rounded-md border border-amber-800 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100 md:col-span-2"><label className="font-bold">YouTubeの公開範囲<select required value={draftYoutubePrivacy} onChange={(event) => setDraftYoutubePrivacy(event.target.value as typeof draftYoutubePrivacy)} className="mt-2 block w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white"><option value="">選択してください</option><option value="private">非公開</option><option value="unlisted">限定公開</option><option value="public">公開</option></select></label><p className="mt-2">予約時刻にアップロードします。「公開」はアップロード後に公開、「限定公開」はリンクを知る人が視聴できます。「非公開」はアップロード後も非公開のままで、予約時刻に自動公開されません。対象チャンネル・動画の公開範囲とYouTube API利用条件を確認してください。</p><a className="underline" href="https://developers.google.com/youtube/terms/api-services-terms-of-service" target="_blank" rel="noreferrer">YouTube API利用条件</a></div>}
          <div className="flex items-end"><button type="button" disabled={preparingDraft || !mediaFile || !draftChannelId || !draftCaption.trim() || !draftSchedule || (publishableChannels.find((channel) => channel.channelId === draftChannelId)?.key === "youtube_shorts" && !draftYoutubePrivacy)} onClick={() => void prepareDraft()} className="rounded-md bg-violet-500 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{preparingDraft ? "非公開保存・登録中…" : "素材を保存して確認待ちへ"}</button></div>
          <p className="text-[11px] leading-5 text-amber-200 md:col-span-2">FANZAサンプルの取得・切り抜きはこの入力欄では行いません。利用許可と各媒体の投稿条件を確認した素材だけを選んでください。</p>
        </div>
      </div>
      <div className="mt-6 border-t border-violet-900/70 pt-5">
        <h3 className="text-base font-black text-white">公開前の確認</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-400">素材・本文・投稿先・日時を確認してから判断してください。承認後に内容が変わると、確認待ちに戻ります。</p>
        {reviewJobs.length === 0 ? <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-400">確認待ちの投稿はありません。</p> : (
          <div className="mt-3 grid gap-3">
            {reviewJobs.map((job) => (
              <article key={job.id} className="rounded-lg border border-amber-800 bg-zinc-950/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-white">{job.channel?.account_label ?? job.channel?.platform ?? "投稿先未設定"}</p>
                  <p className="text-xs text-amber-200">公開予定: {new Date(job.scheduled_at).toLocaleString("ja-JP")}</p>
                </div>
                {job.channel?.platform === "youtube_shorts" && <p className="mt-2 rounded-md border border-amber-800 bg-amber-950/30 p-2 text-xs text-amber-100">YouTube公開範囲: {job.youtube_privacy_status === "public" ? "公開" : job.youtube_privacy_status === "unlisted" ? "限定公開" : job.youtube_privacy_status === "private" ? "非公開" : "未設定（承認不可）"}</p>}
                {job.channel?.platform === "tiktok" && <p className="mt-2 rounded-md border border-rose-800 bg-rose-950/30 p-2 text-xs text-rose-100">TikTok運用は廃止されています。この投稿は承認できません。</p>}
                {job.channel?.platform === "youtube_shorts" && <p className="mt-2 text-xs leading-5 text-amber-100">YouTube投稿では、対象チャンネルと公開範囲を選び、YouTube API利用条件と権利・プライバシーへの配慮を確認してください。API利用条件の案内はこの承認画面でも表示しています。</p>}
                {job.content_kind === "video" && job.previewUrl && <video className="mt-3 max-h-[480px] w-full rounded-lg bg-black object-contain" src={job.previewUrl} controls playsInline />}
                {job.content_kind === "image" && job.previewUrl && <img className="mt-3 max-h-[480px] w-full rounded-lg bg-black object-contain" src={job.previewUrl} alt="投稿予定素材" />}
                {job.content_kind !== "text" && !job.previewUrl && <p className="mt-3 rounded-md border border-rose-800 bg-rose-950/30 p-3 text-xs text-rose-200">素材プレビューを取得できません{job.previewError === "asset_changed" ? "（登録後に素材が変わりました）" : ""}。確認できるまで承認できません。</p>}
                {(job.source_work_id || job.source_catalog_content_id) && <><p className="mt-2 text-[11px] leading-5 text-violet-200">公式サンプル由来 / {job.source_work_id ? `作品ID ${job.source_work_id}` : `APIカタログID ${job.source_catalog_content_id}`} / メーカー {job.source_maker ?? "未記録"} / {job.source_sample_host ?? "ホスト未記録"} / 切り抜き {job.trim_start_seconds ?? "?"}〜{job.trim_end_seconds ?? "?"}秒。元URLハッシュは記録済みです。</p><p className="mt-1 text-[11px] leading-5"><a className="text-violet-300 underline" href="https://support.dmm.com/affiliate/article/44123" target="_blank" rel="noreferrer">DMMの利用条件</a><span className="mx-2 text-zinc-500">/</span><a className="text-violet-300 underline" href="https://docs.google.com/forms/d/e/1FAIpQLSdH2qwHdfDrfwKKHbeV9wQYHYzYvjB30qkgJNAVUQY8z1VHRw/viewform" target="_blank" rel="noreferrer">最新の利用可能メーカー一覧</a></p><label className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-200"><input type="checkbox" checked={Boolean(sourceUsageChecks[job.id])} onChange={(event) => setSourceUsageChecks((current) => ({ ...current, [job.id]: event.target.checked }))} className="mt-1" />メーカー「{job.source_maker ?? "未記録"}」が現在の利用可能一覧にあり、このサンプルの切り抜き条件を確認しました。編集は短縮・切り抜きだけで、別シーン・文字・音声は追加していません。</label></>}
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-black/40 p-3 font-sans text-sm text-zinc-100">{job.caption}</pre>
                <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-300">
                  <input type="checkbox" checked={Boolean(reviewChecks[job.id])} onChange={(event) => setReviewChecks((current) => ({ ...current, [job.id]: event.target.checked }))} className="mt-1" />
                  素材を実際に確認し、センシティブな表現がないこと、素材の利用条件と投稿先への適合、本文・投稿先・公開日時がこの内容でよいことを確認しました。{job.channel?.platform === "youtube_shorts" ? " YouTubeの対象チャンネル・公開範囲とAPI利用条件の案内も確認しました。" : ""}
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.channel?.platform !== "tiktok" && <button type="button" disabled={!reviewChecks[job.id] || Boolean((job.source_work_id || job.source_catalog_content_id) && !sourceUsageChecks[job.id]) || busyReview === job.id || (job.content_kind !== "text" && !job.previewUrl)} onClick={() => void decideReview(job, "approve")} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busyReview === job.id ? "保存中…" : "確認して自動投稿を承認"}</button>}
                  <button type="button" disabled={busyReview === job.id} onClick={() => void decideReview(job, "reject")} className="rounded-md border border-rose-700 px-3 py-2 text-xs font-bold text-rose-200 disabled:opacity-40">{job.channel?.platform === "tiktok" ? "廃止済み投稿を見送る" : "見送る"}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6 border-t border-violet-900/70 pt-5">
        <h3 className="text-base font-black text-white">最近の予約・配信結果</h3>
        {recentJobs.length === 0 ? <p className="mt-3 text-xs text-zinc-500">履歴はありません。</p> : (
          <ul className="mt-3 grid gap-2">
            {recentJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-xs">
                <span className="font-bold text-zinc-200">{job.channel?.account_label ?? job.channel?.platform ?? "投稿先不明"}</span>
                <span className="text-zinc-400">{job.status === "scheduled" ? "予約済み" : job.status === "publishing" ? "配信中" : job.status === "published" ? (job.channel?.platform === "tiktok" ? "TikTok受付完了・公開状態未確認" : job.channel?.platform === "youtube_shorts" && job.youtube_privacy_status === "private" ? "アップロード完了・非公開のまま" : job.channel?.platform === "youtube_shorts" && job.youtube_privacy_status === "unlisted" ? "アップロード完了・限定公開" : "公開済み") : job.status === "failed" ? `失敗: ${job.last_error_code ?? "要確認"}` : job.status === "rejected" ? "見送り" : job.status}</span>
                <span className="text-zinc-500">{job.published_at ? `公開 ${new Date(job.published_at).toLocaleString("ja-JP")}` : `予定 ${new Date(job.scheduled_at).toLocaleString("ja-JP")}`}</span>
                {job.provider_request_id && <span className="font-mono text-[10px] text-zinc-500">受付ID {job.provider_request_id}</span>}
                {job.provider_post_id && <span className="font-mono text-[10px] text-zinc-500">ID {job.provider_post_id}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
