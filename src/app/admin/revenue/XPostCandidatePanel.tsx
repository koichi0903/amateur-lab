"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  ListChecks,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Target,
  Trophy,
  UserRound,
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

type XReplyTarget = {
  key: string;
  query: string;
  template: string;
};

type XFollowUpReply = {
  key: string;
  candidateKey: string;
  title: string;
  replies: string[];
};

type XPatternStat = {
  key: XPostCandidate["category"];
  label: string;
  posts: number;
  clicks: number;
};

type XZeroClickReason = {
  key: string;
  title: string;
  reason: string;
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
      label: `未投稿が${remainingPosts.length}本あります`,
      detail: `まずはこれから: ${remainingPosts[0].title}`,
      priority: "high",
    });
  } else {
    actions.push({
      key: "all-posted",
      label: "今日の3投稿は完了",
      detail: "次は補足リプを1つずつ付けて、余裕があれば返信先を探します。",
      priority: "medium",
    });
  }

  actions.push({
    key: "reply-search",
    label: "関連投稿を探す",
    detail: "無理に返信しなくてOK。自然に入れそうな投稿があれば、役に立つ一言だけ返します。",
    priority: "high",
  });

  if (winner) {
    actions.push({
      key: "reuse-winner",
      label: "クリックされた型を再利用",
      detail: `${winner.clicksSevenDays}クリック: ${winner.title}`,
      priority: "medium",
    });
  }

  if (replace) {
    actions.push({
      key: "replace-loser",
      label: "クリック0の切り口を変える",
      detail: `見せ方を変える作品: ${replace.title}`,
      priority: "medium",
    });
  }

  actions.push({
    key: "observe",
    label: `判定待ち: ${testingCount}本`,
    detail: "7日たつ前に失敗判定しない。投稿を続けながらクリックを待ちます。",
    priority: "low",
  });

  return actions.slice(0, 5);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildReplyTargets(
  candidates: XPostCandidate[],
  outcomes: XPostOutcome[],
): XReplyTarget[] {
  const winningTitles = outcomes
    .filter((outcome) => outcome.status === "winner")
    .map((outcome) => outcome.title);
  const candidateTitles = candidates.map((candidate) => candidate.title);
  const titles = [...winningTitles, ...candidateTitles].slice(0, 3);
  const targets: XReplyTarget[] = [
    {
      key: "fanza-sale",
      query: "FANZA sale",
      template: "セール対象で迷っている人向けに、価格と見どころを先に確認すると選びやすいです。",
    },
    {
      key: "fanza-recommend",
      query: "FANZA おすすめ",
      template: "まず価格、評価数、サンプルの順で見ると失敗しにくいです。",
    },
    {
      key: "fanza-new",
      query: "FANZA 新作",
      template: "新作は発売直後の価格とレビュー数の伸びを見てから選ぶのが良さそうです。",
    },
  ];

  titles.forEach((title, index) => {
    targets.push({
      key: `title-${index}`,
      query: title,
      template: `この作品なら、最初にサンプルと価格を見て判断するのが良さそうです: ${title}`,
    });
  });

  return targets.slice(0, 6);
}

function followUpRepliesFor(candidate: XPostCandidate): string[] {
  if (candidate.category === "deal") {
    return [
      "これ、安さだけで見るよりサンプルの空気が合うか先に見た方がよさそう。刺さる人にはかなり得だと思う。",
      "セール中なら候補に入れていいやつ。迷うならまずサンプルだけ見て、雰囲気が合えば買いでよさそう。",
    ];
  }

  if (candidate.category === "score") {
    return [
      "こういうのは点数だけじゃなくて、レビュー数もある程度あるのが安心材料。迷ったら候補に入れやすい。",
      "サンプルを見て雰囲気が合うならかなり堅そう。評価だけで押し切るより、まず試し見がよさげ。",
    ];
  }

  if (candidate.category === "new") {
    return [
      "新作はレビュー待ちでもいいけど、サンプルの時点で雰囲気が合うなら早めに見る価値ありそう。",
      "まだ情報が少ない分、タイトルよりサンプルの第一印象で決めるのがよさげ。気になる人は先に確認で。",
    ];
  }

  return [
    "実際に選ばれてる作品は、迷ったときに候補へ入れやすい。まず外しにくいところから見たい人向け。",
    "売れてる系は好みが合えば強いので、サンプルで空気だけ先に見ておくと判断しやすいです。",
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildFollowUpReplies(dailyPlan: ReturnType<typeof buildDailyPlan>): XFollowUpReply[] {
  return dailyPlan
    .map((item) => item.candidate)
    .filter((candidate): candidate is XPostCandidate => Boolean(candidate))
    .map((candidate) => ({
      key: `follow-${candidate.key}`,
      candidateKey: candidate.key,
      title: candidate.title,
      replies: followUpRepliesFor(candidate),
    }));
}

function buildPatternStats(outcomes: XPostOutcome[]): XPatternStat[] {
  const labels: Record<XPostCandidate["category"], string> = {
    sales: "売れてる訴求",
    deal: "セール訴求",
    score: "スコア訴求",
    new: "新作訴求",
  };

  return (Object.keys(labels) as XPostCandidate["category"][]).map((key) => {
    const rows = outcomes.filter((outcome) => outcome.category === key);
    return {
      key,
      label: labels[key],
      posts: rows.length,
      clicks: rows.reduce((sum, row) => sum + row.clicksSevenDays, 0),
    };
  }).sort((a, b) => b.clicks - a.clicks);
}

function buildZeroClickReasons(outcomes: XPostOutcome[]): XZeroClickReason[] {
  return outcomes
    .filter((outcome) => outcome.status === "replace")
    .slice(0, 5)
    .map((outcome) => {
      const reason = outcome.category === "deal"
        ? "安さだけでは弱い可能性あり。サンプルの雰囲気や見どころを足す。"
        : outcome.category === "score"
          ? "点数だけでは伝わっていない可能性あり。誰向けかを具体化する。"
          : outcome.category === "new"
            ? "新作というだけでは弱い可能性あり。今見る理由を足す。"
            : "売れてる理由が伝わっていない可能性あり。選ばれている理由を足す。";

      return { key: `zero-${outcome.id}`, title: outcome.title, reason };
    });
}

function buildProfileCopy(patternStats: XPatternStat[]) {
  const strongest = patternStats.find((stat) => stat.clicks > 0)?.label ?? "セール・評価";
  return {
    bio: `FANZA作品を${strongest}中心にメモ。価格、サンプル、レビュー数を見て選びやすいものだけ拾います。#PR`,
    pinned: "毎日、価格・サンプル・レビュー数を見て、選びやすいFANZA作品だけメモしています。気になる作品は詳細で確認してください。#PR #FANZA",
  };
}

function buildJapaneseReplyTargets(
  candidates: XPostCandidate[],
  outcomes: XPostOutcome[],
): XReplyTarget[] {
  const winningTitles = outcomes
    .filter((outcome) => outcome.status === "winner")
    .map((outcome) => outcome.title);
  const candidateTitles = candidates.map((candidate) => candidate.title);
  const titles = [...winningTitles, ...candidateTitles].slice(0, 3);
  const targets: XReplyTarget[] = [
    {
      key: "fanza-sale-ja",
      query: "FANZA セール",
      template: "セール中なら、安さだけじゃなくてサンプルの雰囲気まで見てから選ぶと外しにくいです。",
    },
    {
      key: "fanza-recommend-ja",
      query: "FANZA おすすめ",
      template: "迷ってるなら、価格・サンプル・レビュー数の3つが揃っている作品から見ると選びやすいです。",
    },
    {
      key: "fanza-new-ja",
      query: "FANZA 新作",
      template: "新作はレビューが少ないこともあるので、まずサンプルで雰囲気が合うか見るのがよさそうです。",
    },
  ];

  titles.forEach((title, index) => {
    targets.push({
      key: `title-ja-${index}`,
      query: title,
      template: `この作品なら、まずサンプルと価格を見て好みに合うか確認するのがよさそうです。${title}`,
    });
  });

  return targets.slice(0, 6);
}

function naturalFollowUpRepliesFor(candidate: XPostCandidate): string[] {
  if (candidate.category === "deal") {
    return [
      "これ、安さだけで見るよりサンプルの空気が合うか先に見た方がよさそう。刺さる人にはかなり得だと思う。",
      "セール中なら候補に入れていいやつ。迷うならまずサンプルだけ見て、雰囲気が合えば買いでよさそう。",
    ];
  }

  if (candidate.category === "score") {
    return [
      "こういうのは点数だけじゃなくて、レビュー数もある程度あるのが安心材料。迷ったら候補に入れやすい。",
      "サンプルを見て雰囲気が合うならかなり堅そう。評価だけで押し切るより、まず試し見がよさげ。",
    ];
  }

  if (candidate.category === "new") {
    return [
      "新作はレビュー待ちでもいいけど、サンプルの時点で雰囲気が合うなら早めに見る価値ありそう。",
      "まだ情報が少ない分、タイトルよりサンプルの第一印象で決めるのがよさげ。気になる人は先に確認で。",
    ];
  }

  return [
    "実際に選ばれてる作品は、迷ったときに候補へ入れやすい。まず外しにくいところから見たい人向け。",
    "売れてる系は好みが合えば強いので、サンプルで空気だけ先に見ておくと判断しやすいです。",
  ];
}

function buildNaturalFollowUpReplies(dailyPlan: ReturnType<typeof buildDailyPlan>): XFollowUpReply[] {
  return dailyPlan
    .map((item) => item.candidate)
    .filter((candidate): candidate is XPostCandidate => Boolean(candidate))
    .map((candidate) => ({
      key: `natural-follow-${candidate.key}`,
      candidateKey: candidate.key,
      title: candidate.title,
      replies: naturalFollowUpRepliesFor(candidate),
    }));
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
  const [doneActionKeys, setDoneActionKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const dateKey = todayKey();
  const storageKey = `hakkutsu-lab:x-posted:${dateKey}`;
  const actionStorageKey = `hakkutsu-lab:x-actions:${dateKey}`;
  const dailyPlan = useMemo(() => buildDailyPlan(candidates), [candidates]);
  const plannedKeys = dailyPlan
    .map((item) => item.candidate?.key)
    .filter((key): key is string => Boolean(key));
  const postedPlannedCount = plannedKeys.filter((key) => postedKeys.has(key)).length;
  const remainingDailyCandidates = dailyPlan
    .map((item) => item.candidate)
    .filter((candidate): candidate is XPostCandidate => Boolean(candidate))
    .filter((candidate) => !postedKeys.has(candidate.key));
  const groupedOutcomes: Record<XPostOutcomeStatus, XPostOutcome[]> = {
    winner: outcomes.filter((outcome) => outcome.status === "winner"),
    testing: outcomes.filter((outcome) => outcome.status === "testing"),
    replace: outcomes.filter((outcome) => outcome.status === "replace"),
  };
  const actionQueue = useMemo(
    () => buildActionQueue({ dailyPlan, postedKeys, outcomes }),
    [dailyPlan, outcomes, postedKeys],
  );
  const replyTargets = useMemo(
    () => buildJapaneseReplyTargets(candidates, outcomes),
    [candidates, outcomes],
  );
  const followUpReplies = useMemo(() => buildNaturalFollowUpReplies(dailyPlan), [dailyPlan]);
  const patternStats = useMemo(() => buildPatternStats(outcomes), [outcomes]);
  const zeroClickReasons = useMemo(() => buildZeroClickReasons(outcomes), [outcomes]);
  const profileCopy = useMemo(() => buildProfileCopy(patternStats), [patternStats]);

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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(actionStorageKey);
      setDoneActionKeys(new Set(stored ? (JSON.parse(stored) as string[]) : []));
    } catch {
      setDoneActionKeys(new Set());
    }
  }, [actionStorageKey]);

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  }

  async function copyPost(candidate: XPostCandidate) {
    await copyText(candidate.key, candidate.postText);
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

  async function savePosted(candidate: XPostCandidate) {
    const response = await fetch("/api/admin/x-posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postKey: candidate.key,
        workId: candidate.workId,
        category: candidate.category,
        title: candidate.title,
        postText: candidate.postText,
        postDate: dateKey,
      }),
    });

    if (!response.ok) throw new Error("Failed to save X post log");
  }

  async function launchTodayPosts() {
    if (!remainingDailyCandidates.length || savingKey) return;

    setSavingKey("bulk");
    const draftWindows = remainingDailyCandidates.map(() => {
      const draftWindow = window.open("about:blank", "_blank");
      if (draftWindow) draftWindow.opener = null;
      return draftWindow;
    });
    await copyText(
      "bulk-posts",
      remainingDailyCandidates
        .map((candidate, index) => `#${index + 1}\n${candidate.postText}`)
        .join("\n\n---\n\n"),
    );

    remainingDailyCandidates.forEach((candidate, index) => {
      window.setTimeout(() => {
        const url = `https://x.com/intent/post?text=${encodeURIComponent(candidate.postText)}`;
        const draftWindow = draftWindows[index];
        if (draftWindow) draftWindow.location.href = url;
        else window.open(url, "_blank", "noopener,noreferrer");
      }, index * 350);
    });

    try {
      await Promise.all(remainingDailyCandidates.map(savePosted));
      setPostedKeys((current) => {
        const next = new Set(current);
        remainingDailyCandidates.forEach((candidate) => next.add(candidate.key));

        try {
          window.localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // Local progress is a convenience only.
        }

        return next;
      });
    } catch {
      // Opened drafts still remain usable even when server logging fails.
    }

    setSavingKey(null);
  }

  async function copyAllFollowUps() {
    await copyText(
      "all-followups",
      followUpReplies
        .map((item, index) => [
          `投稿${index + 1}: ${item.title}`,
          ...item.replies.map((reply, replyIndex) => `補足${replyIndex + 1}: ${reply}`),
        ].join("\n"))
        .join("\n\n---\n\n"),
    );
  }

  function openReplySearches() {
    replyTargets.slice(0, 3).forEach((target, index) => {
      window.setTimeout(() => {
        window.open(
          `https://x.com/search?q=${encodeURIComponent(target.query)}&src=typed_query&f=live`,
          "_blank",
          "noopener,noreferrer",
        );
      }, index * 350);
    });
  }

  function toggleActionDone(actionKey: string) {
    setDoneActionKeys((current) => {
      const next = new Set(current);
      if (next.has(actionKey)) next.delete(actionKey);
      else next.add(actionKey);

      try {
        window.localStorage.setItem(actionStorageKey, JSON.stringify([...next]));
      } catch {
        // Local action progress is only for today's dashboard session.
      }

      return next;
    });
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
            今日
          </p>
          <p className="mt-1 font-black text-white">
            {postedPlannedCount}/3 投稿済み
          </p>
          <p className="mt-1 text-xs text-zinc-500">{dateKey}</p>
          <button
            type="button"
            onClick={launchTodayPosts}
            disabled={!remainingDailyCandidates.length || savingKey === "bulk"}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-black transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            <Send size={14} />
            {savingKey === "bulk"
              ? "起動中..."
              : remainingDailyCandidates.length
                ? `未投稿${remainingDailyCandidates.length}本を開く`
                : "投稿準備完了"}
          </button>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-300" size={18} />
          <h3 className="text-sm font-black">X投稿の判定</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {([
            {
              key: "winner" as const,
              label: "残す",
              note: "7日以内にクリックあり",
              icon: <Trophy size={16} />,
              tone: "border-emerald-800 bg-emerald-950/30 text-emerald-300",
            },
            {
              key: "testing" as const,
              label: "判定待ち",
              note: "投稿から7日未満",
              icon: <Target size={16} />,
              tone: "border-sky-800 bg-sky-950/30 text-sky-300",
            },
            {
              key: "replace" as const,
              label: "差し替え",
              note: "7日後もクリックなし",
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
                      {outcome.clicksSevenDays}クリック / {outcome.daysSincePost}日目 / {outcome.recommendation}
                    </p>
                  </div>
                ))}
                {!groupedOutcomes[group.key].length && (
                  <p className="py-3 text-xs text-zinc-600">まだ対象の投稿はありません。</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <ListChecks className="text-emerald-300" size={18} />
          <h3 className="text-sm font-black">今日やること</h3>
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
                  {action.priority === "high" ? "優先" : action.priority === "medium" ? "次点" : "確認"}
                </span>
              </div>
              <p className={`mt-3 text-xs font-black leading-5 ${
                doneActionKeys.has(action.key) ? "text-zinc-500 line-through" : "text-zinc-100"
              }`}>
                {action.label}
              </p>
              <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-zinc-500">
                {action.detail}
              </p>
              <button
                type="button"
                onClick={() => toggleActionDone(action.key)}
                className={`mt-3 inline-flex h-8 items-center gap-2 rounded-xl border px-3 text-[11px] font-black transition ${
                  doneActionKeys.has(action.key)
                    ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                    : "border-zinc-700 hover:border-emerald-500 hover:text-emerald-300"
                }`}
              >
                <Check size={13} />
                {doneActionKeys.has(action.key) ? "完了" : "完了にする"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-300" size={18} />
            <h3 className="text-sm font-black">投稿後に付ける補足リプ</h3>
          </div>
          <button
            type="button"
            onClick={copyAllFollowUps}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 text-xs font-black transition hover:border-amber-400 hover:text-amber-200"
          >
            {copiedKey === "all-followups" ? <Check size={14} /> : <Copy size={14} />}
            {copiedKey === "all-followups" ? "コピー済み" : "補足リプをまとめてコピー"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {followUpReplies.map((item, index) => (
            <div key={item.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs font-black text-sky-300">投稿{index + 1}</p>
              <p className="mt-1 line-clamp-1 text-xs font-black text-zinc-100">{item.title}</p>
              <div className="mt-3 space-y-2">
                {item.replies.map((reply, replyIndex) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => copyText(`${item.key}-${replyIndex}`, reply)}
                    className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-[11px] leading-5 text-zinc-400 transition hover:border-amber-500 hover:text-amber-100"
                  >
                    {copiedKey === `${item.key}-${replyIndex}` ? "コピー済み: " : `補足${replyIndex + 1}: `}
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!followUpReplies.length && (
            <p className="text-xs text-zinc-600">今日の投稿候補がまだありません。</p>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="text-sky-300" size={18} />
          <h3 className="text-sm font-black">返信先探し</h3>
        </div>
        <button
          type="button"
          onClick={openReplySearches}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-xs font-black transition hover:border-sky-500 hover:text-sky-300"
        >
          <Search size={14} />
          検索をまとめて開く
        </button>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {replyTargets.map((target) => (
            <div key={target.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="line-clamp-1 text-xs font-black text-zinc-100">{target.query}</p>
              <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-zinc-500">
                {target.template}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://x.com/search?q=${encodeURIComponent(target.query)}&src=typed_query&f=live`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-xs font-black transition hover:border-sky-500 hover:text-sky-300"
                >
                  <Search size={14} />
                  検索
                </a>
                <button
                  type="button"
                  onClick={() => copyText(`reply-${target.key}`, target.template)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-xs font-black transition hover:border-emerald-500 hover:text-emerald-300"
                >
                  {copiedKey === `reply-${target.key}` ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === `reply-${target.key}` ? "コピー済み" : "返信文をコピー"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-emerald-300" size={18} />
          <h3 className="text-sm font-black">クリックされた型の分析</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {patternStats.map((stat) => (
            <div key={stat.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs font-black text-zinc-100">{stat.label}</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{stat.clicks}</p>
              <p className="mt-1 text-[11px] text-zinc-500">記録済み {stat.posts}本</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs font-black text-zinc-100">明日の寄せ方</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              {patternStats[0]?.clicks
                ? `まず${patternStats[0].label}を少し増やします。毎日3投稿のペースは崩しません。`
                : "まだ勝ち型はありません。最初のクリックが出るまで、今の配分で続けます。"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs font-black text-zinc-100">クリック0の直し方</p>
            <div className="mt-2 space-y-2">
              {zeroClickReasons.map((item) => (
                <p key={item.key} className="line-clamp-2 text-[11px] leading-5 text-zinc-500">
                  {item.title}: {item.reason}
                </p>
              ))}
              {!zeroClickReasons.length && (
                <p className="text-[11px] text-zinc-600">7日経過したクリック0投稿はまだありません。</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <UserRound className="text-violet-300" size={18} />
          <h3 className="text-sm font-black">プロフィールと固定投稿</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs font-black text-zinc-100">プロフィール文案</p>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">{profileCopy.bio}</p>
            <button
              type="button"
              onClick={() => copyText("profile-bio", profileCopy.bio)}
              className="mt-3 inline-flex h-8 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-[11px] font-black transition hover:border-violet-500 hover:text-violet-200"
            >
              {copiedKey === "profile-bio" ? <Check size={13} /> : <Copy size={13} />}
              {copiedKey === "profile-bio" ? "コピー済み" : "プロフィール文をコピー"}
            </button>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs font-black text-zinc-100">固定投稿案</p>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">{profileCopy.pinned}</p>
            <button
              type="button"
              onClick={() => copyText("profile-pinned", profileCopy.pinned)}
              className="mt-3 inline-flex h-8 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-[11px] font-black transition hover:border-violet-500 hover:text-violet-200"
            >
              {copiedKey === "profile-pinned" ? <Check size={13} /> : <Copy size={13} />}
              {copiedKey === "profile-pinned" ? "コピー済み" : "固定投稿をコピー"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-cyan-300" size={18} />
          <h3 className="text-sm font-black">30日運用プラン</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {[
            ["1-7日目", "毎日3投稿。各投稿に補足リプを1つ付ける。早すぎる失敗判定はしない。"],
            ["8-14日目", "クリックされた型を少し増やす。クリック0の切り口は言い方を変える。"],
            ["15-21日目", "勝ち型をプロフィール文や固定投稿にも反映する。強い切り口を繰り返す。"],
            ["22-30日目", "伸びる型を残し、弱い型を減らす。Xクリックと売上CSVを見比べる。"],
          ].map(([label, detail]) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs font-black text-cyan-200">{label}</p>
              <p className="mt-2 text-[11px] leading-5 text-zinc-500">{detail}</p>
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
