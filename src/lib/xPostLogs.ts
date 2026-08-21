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
