import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { XPostCandidate } from "@/lib/xPostCandidates";

export type XPostLog = {
  id: number;
  post_key: string;
  work_id: number;
  category: XPostCandidate["category"];
  title: string;
  post_text: string;
  post_date: string;
  posted_at: string;
};

export type XPostLogInput = {
  postKey: string;
  workId: number;
  category: XPostCandidate["category"];
  title: string;
  postText: string;
  postDate: string;
};

export type XPostOutcomeStatus = "winner" | "testing" | "replace";

export type XPostOutcome = XPostLog & {
  clicksSevenDays: number;
  daysSincePost: number;
  status: XPostOutcomeStatus;
  recommendation: string;
};

type XClickRow = {
  work_id: number;
  clicked_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRecentXPostLogs(): Promise<{
  logs: XPostLog[];
  error: string | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("x_post_logs")
    .select("id,post_key,work_id,category,title,post_text,post_date,posted_at")
    .order("posted_at", { ascending: false })
    .limit(200);

  if (error) {
    return { logs: [], error: error.message };
  }

  return { logs: (data ?? []) as XPostLog[], error: null };
}

export async function saveXPostLog(input: XPostLogInput) {
  return supabaseAdmin.from("x_post_logs").upsert(
    {
      post_key: input.postKey,
      work_id: input.workId,
      category: input.category,
      title: input.title,
      post_text: input.postText,
      post_date: input.postDate,
      posted_at: new Date().toISOString(),
    },
    { onConflict: "post_key,post_date" },
  );
}

export async function deleteXPostLog(postKey: string, postDate: string) {
  return supabaseAdmin
    .from("x_post_logs")
    .delete()
    .eq("post_key", postKey)
    .eq("post_date", postDate);
}

export async function getXPostOutcomes(): Promise<{
  outcomes: XPostOutcome[];
  error: string | null;
}> {
  const { logs, error } = await getRecentXPostLogs();

  if (error) {
    return { outcomes: [], error };
  }

  if (!logs.length) {
    return { outcomes: [], error: null };
  }

  const workIds = Array.from(new Set(logs.map((log) => log.work_id)));
  const oldestPostTime = Math.min(
    ...logs.map((log) => new Date(log.posted_at).getTime()),
  );
  const clickCutoff = new Date(oldestPostTime).toISOString();
  const { data, error: clickError } = await supabaseAdmin
    .from("affiliate_clicks")
    .select("work_id,clicked_at")
    .eq("source_page", "x")
    .in("work_id", workIds)
    .gte("clicked_at", clickCutoff);

  if (clickError) {
    return { outcomes: [], error: clickError.message };
  }

  const now = Date.now();
  const clicks = (data ?? []) as XClickRow[];
  const outcomes = logs.map((log) => {
    const postedAt = new Date(log.posted_at).getTime();
    const windowEnd = postedAt + (7 * DAY_MS);
    const clicksSevenDays = clicks.filter((click) => {
      const clickedAt = new Date(click.clicked_at).getTime();
      return (
        click.work_id === log.work_id &&
        clickedAt >= postedAt &&
        clickedAt <= windowEnd
      );
    }).length;
    const daysSincePost = Math.max(0, Math.floor((now - postedAt) / DAY_MS));
    const status: XPostOutcomeStatus = daysSincePost < 7
      ? "testing"
      : clicksSevenDays > 0
        ? "winner"
        : "replace";
    const recommendation = status === "testing"
      ? "7日目まで様子を見る"
      : status === "winner"
        ? "この切り口を次の投稿でも使う"
        : "見せ方を変えて再投稿する";

    return {
      ...log,
      clicksSevenDays,
      daysSincePost,
      status,
      recommendation,
    };
  });

  return {
    outcomes: outcomes.sort((a, b) => {
      if (a.status !== b.status) {
        const order: Record<XPostOutcomeStatus, number> = {
          winner: 0,
          testing: 1,
          replace: 2,
        };
        return order[a.status] - order[b.status];
      }
      return b.clicksSevenDays - a.clicksSevenDays;
    }),
    error: null,
  };
}
