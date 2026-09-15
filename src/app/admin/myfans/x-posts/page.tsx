import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { PostForm } from "../MyfansAdminForms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyfansXPostsPage() {
  const analytics = await getMyfansAnalytics();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin/myfans" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white">
          <ArrowLeft size={16} /> myfansへ戻る
        </Link>
        <h1 className="mt-7 text-3xl font-black sm:text-5xl">myfans X投稿候補</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          本文、自己リプ、#PR、引用元X URL、投稿型、商品選定理由を管理します。自動投稿は行いません。
        </p>

        {analytics.error && (
          <section className="mt-8 rounded-xl border border-amber-800 bg-amber-950/30 p-5 text-sm text-amber-200">
            myfans用テーブルが未適用です。
          </section>
        )}

        <PostForm products={analytics.products} />

        <section className="mt-8 space-y-4">
          {analytics.posts.map((post) => (
            <article key={post.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black text-emerald-300">{post.post_type} / {post.status}</p>
                  <h2 className="mt-2 text-lg font-black">{post.myfans_products?.title ?? "商品未紐付け"}</h2>
                </div>
                <p className="text-xs text-zinc-500">{post.includes_pr ? "#PRあり" : "#PR未設定"} / {post.impressions.toLocaleString("ja-JP")} imp / {(post.clicks ?? 0).toLocaleString("ja-JP")} click</p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg bg-zinc-950 p-4">
                  <p className="text-xs font-black text-zinc-500">本文</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{post.body}</p>
                </div>
                <div className="rounded-lg bg-zinc-950 p-4">
                  <p className="text-xs font-black text-zinc-500">自己リプ</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{post.self_reply || "-"}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-500">{post.selection_reason || "選定理由は未入力です。"}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-emerald-300">
                {post.source_x_url && <a href={post.source_x_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">引用元X <ExternalLink size={12} /></a>}
                {post.x_post_url && <a href={post.x_post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">投稿URL <ExternalLink size={12} /></a>}
              </div>
            </article>
          ))}
          {!analytics.posts.length && <p className="text-sm text-zinc-500">投稿候補はまだありません。</p>}
        </section>
      </div>
    </main>
  );
}
