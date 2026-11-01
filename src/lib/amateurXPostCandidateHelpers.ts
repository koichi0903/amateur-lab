export type AmateurXPostLane = "new_release" | "popular";
export type AmateurXCandidateAction = "add" | "skip_candidate";
export type AmateurXCandidateStatus = "pending" | "posted" | "skipped";

export function getAmateurXCandidateRankLabel(rank?: number | null) {
  return rank ? `人気順位 ${rank}位` : "新作7日間";
}

export function getAmateurXCandidateReleaseDate(apiDate?: string | null) {
  return apiDate?.slice(0, 10) ?? "未取得";
}

export function getAmateurXCandidateStatusLabel(status: AmateurXCandidateStatus) {
  if (status === "pending") return "投稿リストに追加済み（準備中）";
  if (status === "skipped") return "スキップ済み";
  return "投稿済み";
}

export function buildAmateurXCandidateBrowseView<T>(
  data: { candidates: T[]; total: number; hasMore: boolean } | null,
  lane: AmateurXPostLane,
  loading: boolean,
) {
  const candidates = data?.candidates ?? [];
  const activeClass = "bg-emerald-500 text-black";
  const inactiveClass = "border border-zinc-700 text-zinc-300";
  const buttonClass = (active: boolean) => `rounded-lg px-4 py-2 text-sm font-bold ${active ? activeClass : inactiveClass}`;

  return {
    newReleaseButtonClass: buttonClass(lane === "new_release"),
    popularButtonClass: buttonClass(lane === "popular"),
    laneDescription: lane === "popular"
      ? "DMM人気順・MP4確認済み作品を最大500件"
      : "JST直近7日間（今日を含む）・MP4確認済み作品。全アカウントの投稿済み・スキップ済みは除外",
    countLabel: loading ? "読み込み中…" : `${data?.total ?? 0}件`,
    candidates,
    isEmpty: !loading && candidates.length === 0,
    hasMore: data?.hasMore ?? false,
  };
}

export async function runAmateurXCandidateAction(input: {
  action: AmateurXCandidateAction;
  contentId: string;
  lane: AmateurXPostLane;
  request: (payload: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
  setBusy: (busy: boolean) => void;
  setMessage: (message: string) => void;
}) {
  input.setBusy(true);
  input.setMessage("");
  try {
    await input.request({ action: input.action, contentId: input.contentId, lane: input.lane });
    await input.refresh();
  } catch (error) {
    input.setMessage(error instanceof Error ? error.message : String(error));
  } finally {
    input.setBusy(false);
  }
}
