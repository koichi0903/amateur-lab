"use client";

import { Check, ExternalLink } from "lucide-react";
import type { MyfansXPost } from "@/lib/myfansAnalytics";
import { inputClass } from "./MyfansFormPrimitives";
import { metricFields, postDisplayCopy } from "./MyfansExecutionBoardRules";

type PostUpdateMode = "posted" | "url" | "metrics";

type XExecutionPostMetricsProps = {
  postedPosts: MyfansXPost[];
  recordedPosts: MyfansXPost[];
  pendingId: string | number | null;
  onUpdatePost: (post: MyfansXPost, mode: PostUpdateMode, form?: HTMLFormElement) => Promise<void>;
};

export function XExecutionPostMetrics({ postedPosts, recordedPosts, pendingId, onUpdatePost }: XExecutionPostMetricsProps) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-black">投稿後の登録と成績記録</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Xへ手動投稿しただけではここには増えません。投稿URLを貼って保存すると、投稿済みとして記録されます。</p>
        </div>
        <p className="text-xs font-black text-emerald-300">未入力の投稿: {postedPosts.length}件</p>
      </div>
      <div className="mt-4 space-y-4">
        {postedPosts.map((post) => {
          const copy = postDisplayCopy(post);
          return (
            <article key={post.id} className="rounded-lg bg-zinc-950 p-4">
              <p className="text-xs font-black text-emerald-300">{post.status} / {post.link_strategy ?? "未設定"} / {post.post_type}</p>
              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <p className="text-xs font-black text-zinc-500">{copy.label}</p>
                {copy.warning && <p className="mt-2 text-xs font-bold leading-5 text-amber-200">{copy.warning}</p>}
                {copy.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{copy.body}</p>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => onUpdatePost(post, "posted")} disabled={pendingId === post.id} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black"><Check size={15} />投稿済みにする</button>
                {post.x_post_url && <a href={post.x_post_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black"><ExternalLink size={15} />投稿URL</a>}
              </div>
              <form onSubmit={(event) => { event.preventDefault(); onUpdatePost(post, "url", event.currentTarget); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input aria-label="X投稿URL" name="x_post_url" type="url" defaultValue={post.x_post_url} placeholder="投稿URL" className={`${inputClass} min-w-0 flex-1`} />
                <button type="submit" className="h-11 rounded-lg bg-cyan-700 px-4 text-xs font-black">投稿URLを保存</button>
              </form>
              <form onSubmit={(event) => { event.preventDefault(); onUpdatePost(post, "metrics", event.currentTarget); }} className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <p className="text-xs font-black text-emerald-300">おすすめ：投稿から24時間後の数字を入力</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {metricFields.map((field) => (
                    <label key={field.name} className="grid min-w-0 gap-1.5 text-xs font-bold text-zinc-300">
                      <span>{field.label}</span>
                      <span className="min-h-8 text-[11px] leading-4 text-zinc-500">{field.description}</span>
                      <input
                        name={field.name}
                        type="number"
                        min="0"
                        defaultValue={field.name === "clicks" ? post.clicks ?? 0 : post[field.name]}
                        className={`${inputClass} w-full min-w-0`}
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="mt-3 h-11 w-full rounded-lg bg-cyan-700 px-4 text-xs font-black sm:w-auto">この成績を保存</button>
              </form>
            </article>
          );
        })}
        {!postedPosts.length && <p className="text-sm text-zinc-500">成績入力待ちの投稿はありません。Xに投稿した後、投稿URLを保存するとここに出ます。</p>}
      </div>
      {recordedPosts.length > 0 && (
        <details className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <summary className="cursor-pointer text-xs font-black text-zinc-500">入力済み履歴（直近{recordedPosts.length}件）</summary>
          <div className="mt-3 grid gap-2">
            {recordedPosts.map((post) => (
              <div key={post.id} className="rounded-md bg-zinc-900 p-3 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-200">{post.metrics_recorded_at?.slice(0, 16).replace("T", " ")} 入力済み</p>
                <p>表示 {post.impressions.toLocaleString("ja-JP")} / いいね {post.likes_count.toLocaleString("ja-JP")} / RP {post.reposts_count.toLocaleString("ja-JP")} / 返信 {post.replies_count.toLocaleString("ja-JP")} / クリック {(post.clicks ?? 0).toLocaleString("ja-JP")}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
