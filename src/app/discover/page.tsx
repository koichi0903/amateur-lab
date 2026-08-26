import Link from "next/link";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { getAiDiscoveries, type AiDiscovery } from "@/lib/getAiDiscoveries";
import { workDetailHref } from "@/lib/affiliateTracking";

// The discovery dataset is cached in getAiDiscoveries. Keep its database query
// out of the deployment build so a transient statement timeout cannot fail it.
export const dynamic = "force-dynamic";

const styles: Record<AiDiscovery["reasonType"], { label: string; badge: string; accent: string }> = {
  price: { label: "価格発掘", badge: "bg-pink-50 text-pink-700", accent: "text-pink-600" },
  review: { label: "高評価", badge: "bg-amber-50 text-amber-700", accent: "text-amber-600" },
  rank: { label: "人気上昇", badge: "bg-blue-50 text-blue-700", accent: "text-blue-600" },
  score: { label: "スコア発掘", badge: "bg-violet-50 text-violet-700", accent: "text-violet-600" },
  hidden: { label: "隠れた候補", badge: "bg-emerald-50 text-emerald-700", accent: "text-emerald-600" },
};

function currentPrice(work: AiDiscovery) { return work.sale_price > 0 ? work.sale_price : work.price; }

export default async function DiscoverPage() {
  const works = await getAiDiscoveries();
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP / 今日のAI発掘</Link><p className="mt-5 text-xs font-black tracking-[.18em] text-pink-600">AI DISCOVERY</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">今日のAI発掘</h1><p className="mt-3 text-sm text-slate-600">価格・評価・人気・発掘スコアを組み合わせて、今日チェックしたい作品を選びました。</p></div></section>
    <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{works.slice(0, 40).map((work) => { const style = styles[work.reasonType]; const price = currentPrice(work); const hasDiscount = work.list_price != null && work.list_price > price; return <Link key={work.id} href={workDetailHref(work.id, "home")} className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg"><div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 640px) 92vw, 25vw" className="object-cover transition duration-300 group-hover:scale-105" /></div><div className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${style.badge}`}>{style.label}</div><p className="mt-2 line-clamp-2 min-h-10 text-sm font-black leading-5">{work.reason}</p><h2 className="mt-2 line-clamp-2 min-h-10 text-sm font-black leading-5">{work.title}</h2><div className="mt-3 border-t border-slate-100 pt-3">{hasDiscount && <span className="mr-2 text-xs text-slate-400 line-through">通常価格 ¥{work.list_price!.toLocaleString("ja-JP")}</span>}<span className={`text-sm font-black ${style.accent}`}>¥{price.toLocaleString("ja-JP")}</span>{hasDiscount && <span className="ml-2 rounded bg-pink-50 px-1.5 py-0.5 text-[10px] font-black text-pink-600">{Math.round((1 - price / work.list_price!) * 100)}%OFF</span>}</div></Link>; })}</div></div>
  </main></>;
}
