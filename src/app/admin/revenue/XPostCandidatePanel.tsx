"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  ListChecks,
  RefreshCw,
  Send,
  Target,
  Trophy,
} from "lucide-react";
import type { XPostCandidate } from "@/lib/xPostCandidates";
import type { XPostLog, XPostOutcome, XPostOutcomeStatus } from "@/lib/xPostLogs";

const CATEGORY_STYLES: Record<XPostCandidate["category"], string> = {
  sales: "border-emerald-800 bg-emerald-950/30 text-emerald-300",
  deal: "border-rose-800 bg-rose-950/30 text-rose-300",
  score: "border-violet-800 bg-violet-950/30 text-violet-300",
  new: "border-cyan-800 bg-cyan-950/30 text-cyan-300",
};

type DailyPost = {
  slot: string;
  title: string;
  detail: string;
  preferred: XPostCandidate["category"][];
};

type XActionItem = {
  key: string;
  label: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

const DAILY_POSTS: DailyPost[] = [
  {
    slot: "1本目",
    title: "セール訴求",
    detail: "割引率や価格の強い作品。まずクリックを取りに行く投稿。",
    preferred: ["deal", "sales"],
  },
  {
    slot: "2本目",
    title: "発掘スコア訴求",
    detail: "フォロワー0でも理由が伝わる、サイト独自の発見枠。",
    preferred: ["score", "sales"],
  },
  {
    slot: "3本目",
    title: "新作訴求",
    detail: "新着・鮮度で検索やおすすめ露出を狙う投稿。",
    preferred: ["new", "deal"],
  },
];

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildDailyPlan(candidates: XPostCandidate[]) {
  const used = new Set<string>();

  return DAILY_POSTS.map((post) => {
    const candidate =
      candidates.find(
        (item) => !used.has(item.key) && post.preferred.includes(item.category),
      ) ?? candidates.find((item) => !used.has(item.key));

    if (candidate) used.add(candidate.key);
    return { ...post, candidate };
  });
}

function buildActionQueue({
  dailyPlan,
  postedKeys,
  outcomes,
}: {
  dailyPlan: ReturnType<typeof buildDailyPlan>;
  postedKeys: Set<string>;
  outcomes: XPostOutcome[];
}): XActionItem[] {
  const remainingPosts = dailyPlan
    .filter((item) => item.candidate && !postedKeys.has(item.candidate.key))
    .map((item) => item.candidate!);
  const winner = outcomes.find((outcome) => outcome.status === "winner");
  const replace = outcomes.find((outcome) => outcome.status === "replace");
  const testingCount = outcomes.filter((outcome) => outcome.status === "testing").length;
  const actions: XActionItem[] = [];

  if (remainingPosts.length) {
    actions.push({
      key: "post-next",
      label: `Post ${remainingPosts.length} remaining draft${remainingPosts.length === 1 ? "" : "s"}`,
      detail: `Start with: ${remainingPosts[0].title}`,
      priority: "high",
    });
  } else {
    actions.push({
      key: "all-posted",
      label: "Today's 3 posts are done",
      detail: "Spend the rest of the session on replies and observation.",
      priority: "medium",
    });
  }

  actions.push({
    key: "reply-search",
    label: "Reply to 10 related X posts",
    detail: "Search FANZA sale, title keywords, actresses, and genre terms. Reply with one useful note, then only link when it fits.",
    priority: "high",
  });

  if (winner) {
    actions.push({
      key: "reuse-winner",
      label: "Reuse the winning angle",
      detail: `${winner.clicksSevenDays} clicks: ${winner.title}`,
      priority: "medium",
    });
  }

  if (replace) {
    actions.push({
      key: "replace-loser",
      label: "Rewrite one zero-click angle",
      detail: `Replace the hook for: ${replace.title}`,
      priority: "medium",
    });
  }

  actions.push({
    key: "observe",
    label: `Check watch list: ${testingCount} post${testingCount === 1 ? "" : "s"}`,
    detail: "Do not judge posts before day 7. Keep posting while the signal matures.",
    priority: "low",
  });

  return actions.slice(0, 5);
}

export default function XPostCandidatePanel({
  candidates,
  error,
  logs,
  outcomes,
}: {
  candidates: XPostCandidate[];
  error: string | null;
  logs: XPostLog[];
  outcomes: XPostOutcome[];
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [postedKeys, setPostedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const dateKey = todayKey();
  const storageKey = `hakkutsu-lab:x-posted:${dateKey}`;
  const dailyPlan = useMemo(() => buildDailyPlan(candidates), [candidates]);
  const plannedKeys = dailyPlan
    .map((item) => item.candidate?.key)
    .filter((key): key is string => Boolean(key));
  const postedPlannedCount = plannedKeys.filter((key) => postedKeys.has(key)).length;
  const groupedOutcomes: Record<XPostOutcomeStatus, XPostOutcome[]> = {
    winner: outcomes.filter((outcome) => outcome.status === "winner"),
    testing: outcomes.filter((outcome) => outcome.status === "testing"),
    replace: outcomes.filter((outcome) => outcome.status === "replace"),
  };
  const actionQueue = useMemo(
    () => buildActionQueue({ dailyPlan, postedKeys, outcomes }),
    [dailyPlan, outcomes, postedKeys],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      const localKeys = stored ? (JSON.parse(stored) as string[]) : [];
      const persistedKeys = logs
        .filter((log) => log.post_date === dateKey)
        .map((log) => log.post_key);
      setPostedKeys(new Set([...localKeys, ...persistedKeys]));
    } catch {
      const persistedKeys = logs
        .filter((log) => log.post_date === dateKey)
        .map((log) => log.post_key);
      setPostedKeys(new Set(persistedKeys));
    }
  }, [dateKey, logs, storageKey]);

  async function copyPost(candidate: XPostCandidate) {
    await navigator.clipboard.writeText(candidate.postText);
    setCopiedKey(candidate.key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  }

  async function togglePosted(candidate: XPostCandidate) {
    if (savingKey) return;

    const nextPosted = !postedKeys.has(candidate.key);
    setSavingKey(candidate.key);

    const body = JSON.stringify({
      postKey: candidate.key,
      workId: candidate.workId,
      category: candidate.category,
      title: candidate.title,
      postText: candidate.postText,
      postDate: dateKey,
    });

    try {
      const response = await fetch("/api/admin/x-posts", {
        method: nextPosted ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body,
      });

      if (!response.ok) throw new Error("Failed to update X post log");
    } catch {
      setSavingKey(null);
      return;
    }

    setPostedKeys((current) => {
      const next = new Set(current);
      if (nextPosted) next.add(candidate.key);
      else next.delete(candidate.key);

      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Local progress is a convenience only.
      }

      return next;
    });
    setSavingKey(null);
  }

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Send className="mt-0.5 shrink-0 text-sky-400" size={21} />
          <div>
            <h2 className="font-black">X投稿実行ボード</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              フォロワー0の初期運用向けに、今日投稿する3本と候補投稿をまとめます。投稿は必ず内容を確認してから実行してください。
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-sky-900 bg-sky-950/30 px-4 py-3 text-sm">
          <p className="text-xs font-black tracking-[0.16em] text-sky-300">
            TODAY
          </p>
          <p className="mt-1 font-black text-white">
            {postedPlannedCount}/3 投稿済み
          </p>
          <p className="mt-1 text-xs text-zinc-500">{dateKey}</p>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-300" size={18} />
          <h3 className="text-sm font-black">X post outcome board</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {([
            {
              key: "winner" as const,
              label: "Keep",
              note: "7 days / clicked",
              icon: <Trophy size={16} />,
              tone: "border-emerald-800 bg-emerald-950/30 text-emerald-300",
            },
            {
              key: "testing" as const,
              label: "Watch",
              note: "Under 7 days",
              icon: <Target size={16} />,
              tone: "border-sky-800 bg-sky-950/30 text-sky-300",
            },
            {
              key: "replace" as const,
              label: "Replace",
              note: "7 days / no click",
              icon: <RefreshCw size={16} />,
              tone: "border-rose-800 bg-rose-950/30 text-rose-300",
            },
          ]).map((group) => (
            <div key={group.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${group.tone}`}>
                  {group.icon}
                  {group.label}
                </span>
                <span className="text-[11px] font-bold text-zinc-500">{group.note}</span>
              </div>
              <div className="mt-3 space-y-2">
                {groupedOutcomes[group.key].slice(0, 4).map((outcome) => (
                  <div key={outcome.id} className="rounded-lg bg-zinc-950 px-3 py-2">
                    <p className="line-clamp-1 text-xs font-black text-zinc-200">{outcome.title}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {outcome.clicksSevenDays} clicks / day {outcome.daysSincePost} / {outcome.recommendation}
                    </p>
                  </div>
                ))}
                {!groupedOutcomes[group.key].length && (
                  <p className="py-3 text-xs text-zinc-600">No posts yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <ListChecks className="text-emerald-300" size={18} />
          <h3 className="text-sm font-black">Today action queue</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {actionQueue.map((action, index) => (
            <div key={action.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-zinc-500">#{index + 1}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
                    action.priority === "high"
                      ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
                      : action.priority === "medium"
                        ? "border-sky-800 bg-sky-950/30 text-sky-300"
                        : "border-zinc-700 bg-zinc-950 text-zinc-400"
                  }`}
                >
                  {action.priority}
                </span>
              </div>
              <p className="mt-3 text-xs font-black leading-5 text-zinc-100">
                {action.label}
              </p>
              <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-zinc-500">
                {action.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-2">
            <Target className="text-emerald-400" size={18} />
            <h3 className="text-sm font-black">今日やる3投稿</h3>
          </div>
          <div className="mt-4 space-y-3">
            {dailyPlan.map((item) => (
              <div
                key={item.slot}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-sky-300">
                      {item.slot} / {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {item.detail}
                    </p>
                  </div>
                  {item.candidate && (
                    <button
                      type="button"
                      onClick={() => togglePosted(item.candidate!)}
                      className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
                        postedKeys.has(item.candidate.key)
                          ? "border-emerald-700 bg-emerald-950/60 text-emerald-300"
                          : "border-zinc-700 hover:border-emerald-500 hover:text-emerald-300"
                      }`}
                    >
                      <Check size={14} />
                      {savingKey === item.candidate.key
                        ? "保存中"
                        : postedKeys.has(item.candidate.key)
                          ? "投稿済み"
                          : "投稿した"}
                    </button>
                  )}
                </div>
                {item.candidate ? (
                  <p className="mt-3 line-clamp-2 text-sm font-bold text-zinc-200">
                    {item.candidate.title}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    候補が足りません。作品更新後に再確認してください。
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-violet-400" size={18} />
            <h3 className="text-sm font-black">0フォロワー初期運用</h3>
          </div>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
            <li>
              <span className="font-black text-white">1.</span> まず今日の3投稿を出す。フォロワー数ではなく、インプレッションとリンククリックを見る。
            </li>
            <li>
              <span className="font-black text-white">2.</span> 投稿後に同ジャンルの投稿を10分だけ見て、伸びている言い回しを次回に寄せる。
            </li>
            <li>
              <span className="font-black text-white">3.</span> 7日ごとにクリックが出た型だけ残す。クリック0の型は入れ替える。
            </li>
          </ol>
          <p className="mt-4 rounded-xl border border-amber-900 bg-amber-950/30 p-3 text-xs leading-5 text-amber-200">
            最初の目標はフォロワー獲得ではなく、100投稿で「クリックされる投稿型」を見つけることです。
          </p>
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs font-black text-zinc-300">最近の投稿ログ</p>
            <div className="mt-2 space-y-2">
              {logs.slice(0, 5).map((log) => (
                <p key={log.id} className="line-clamp-1 text-xs text-zinc-500">
                  {log.post_date} / {log.title}
                </p>
              ))}
              {!logs.length && (
                <p className="text-xs text-zinc-600">まだ投稿ログはありません。</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-amber-900 bg-amber-950/30 p-3 text-xs leading-5 text-amber-200">
          一部候補を取得できませんでした: {error}
        </p>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {candidates.map((candidate) => (
          <article
            key={candidate.key}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${CATEGORY_STYLES[candidate.category]}`}
              >
                {candidate.label}
              </span>
              <span className="text-xs font-bold text-zinc-500">
                {candidate.reason}
              </span>
              {postedKeys.has(candidate.key) && (
                <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-black text-emerald-300">
                  投稿済み
                </span>
              )}
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-bold text-zinc-200">
              {candidate.title}
            </p>
            <textarea
              readOnly
              value={candidate.postText}
              aria-label={`${candidate.title}のX投稿文`}
              className="mt-3 h-44 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-6 text-zinc-200 outline-none focus:border-sky-600"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span
                className={`text-xs font-bold ${
                  candidate.postText.length > 280
                    ? "text-red-400"
                    : "text-zinc-500"
                }`}
              >
                {candidate.postText.length}/280文字
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => togglePosted(candidate)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-black transition ${
                    postedKeys.has(candidate.key)
                      ? "border-emerald-700 bg-emerald-950/60 text-emerald-300"
                      : "border-zinc-700 hover:border-emerald-500 hover:text-emerald-300"
                  }`}
                >
                  <Check size={15} />
                  {savingKey === candidate.key
                    ? "保存中"
                    : postedKeys.has(candidate.key)
                      ? "投稿済み"
                      : "投稿した"}
                </button>
                <button
                  type="button"
                  onClick={() => copyPost(candidate)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-700 px-4 text-xs font-black transition hover:border-sky-500 hover:text-sky-300"
                >
                  {copiedKey === candidate.key ? (
                    <Check size={15} />
                  ) : (
                    <Copy size={15} />
                  )}
                  {copiedKey === candidate.key ? "コピー済み" : "本文コピー"}
                </button>
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(candidate.postText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-black transition hover:bg-sky-100"
                >
                  Xで開く <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!candidates.length && !error && (
        <p className="mt-5 text-sm text-zinc-500">
          投稿候補を作れる作品がまだありません。
        </p>
      )}
      <p className="mt-4 text-xs leading-5 text-zinc-600">
        自動投稿は行いません。成人向けコンテンツに関するXの表示ルールと投稿内容を確認してから投稿してください。
      </p>
      <span className="sr-only" aria-live="polite">
        {copiedKey ? "投稿文をコピーしました" : ""}
      </span>
    </section>
  );
}
