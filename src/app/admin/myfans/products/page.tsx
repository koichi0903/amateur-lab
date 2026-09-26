import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { BulkProductGuide, ProductForm } from "../MyfansAdminForms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyfansProductsPage() {
  const analytics = await getMyfansAnalytics();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin/myfans" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white">
          <ArrowLeft size={16} /> myfansへ戻る
        </Link>
        <h1 className="mt-7 text-3xl font-black sm:text-5xl">myfans商品</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          価格、報酬率、想定報酬、人気指標、引用元X、アフィリンク、選定理由をFANZA作品とは別管理します。
        </p>

        {analytics.error && (
          <section className="mt-8 rounded-xl border border-amber-800 bg-amber-950/30 p-5 text-sm text-amber-200">
            myfans用テーブルが未適用です。
          </section>
        )}

        <ProductForm creators={analytics.creators} media={analytics.media} />
        <BulkProductGuide />

        <section className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="pb-3 pr-4">商品</th>
                <th className="pb-3 pr-4">クリエイター</th>
                <th className="pb-3 pr-4">状態</th>
                <th className="pb-3 pr-4 text-right">価格</th>
                <th className="pb-3 pr-4 text-right">報酬率</th>
                <th className="pb-3 pr-4 text-right">想定報酬</th>
                <th className="pb-3 pr-4 text-right">人気</th>
                <th className="pb-3 pr-4 text-right">反応</th>
                <th className="pb-3 pr-4 text-right">スコア</th>
                <th className="pb-3 pr-4">承認メディア</th>
                <th className="pb-3">選定理由</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {analytics.products.map((product) => (
                <tr key={product.id}>
                  <td className="max-w-xs py-4 pr-4">
                    <p className="line-clamp-1 font-black">{product.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{product.genre || product.product_type}</p>
                  </td>
                  <td className="py-4 pr-4 text-zinc-300">{product.myfans_creators?.display_name ?? "-"}</td>
                  <td className="py-4 pr-4 font-bold text-emerald-300">{product.status}</td>
                  <td className="py-4 pr-4 text-right">¥{product.price.toLocaleString("ja-JP")}</td>
                  <td className="py-4 pr-4 text-right">{product.reward_rate}%</td>
                  <td className="py-4 pr-4 text-right font-black text-emerald-300">¥{product.estimated_reward.toLocaleString("ja-JP")}</td>
                  <td className="py-4 pr-4 text-right">{product.popularity_rank ? `${product.popularity_rank}位` : "-"}</td>
                  <td className="py-4 pr-4 text-right text-zinc-400">{product.likes_count}いいね / {product.saves_count}保存</td>
                  <td className="py-4 pr-4 text-right font-black text-cyan-300">{product.selection_score ?? 0}</td>
                  <td className="py-4 pr-4 text-zinc-300">{product.approved_media_name || product.affiliate_media_id || "-"}</td>
                  <td className="max-w-sm py-4">
                    <p className="line-clamp-2 text-zinc-400">{product.selection_reason || "-"}</p>
                    {(product.product_url || product.source_x_url) && (
                      <div className="mt-2 flex gap-3 text-xs font-bold text-emerald-300">
                        {product.product_url && <a href={product.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">商品 <ExternalLink size={12} /></a>}
                        {product.source_x_url && <a href={product.source_x_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">引用元X <ExternalLink size={12} /></a>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!analytics.products.length && <p className="py-6 text-sm text-zinc-500">商品候補はまだありません。</p>}
        </section>
      </div>
    </main>
  );
}
