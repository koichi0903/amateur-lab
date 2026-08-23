import Link from "next/link";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { getAiDiscoveries } from "@/lib/getAiDiscoveries";
import { workDetailHref } from "@/lib/affiliateTracking";

export const revalidate = 3600;

export default async function DiscoverPage() {
  const works = await getAiDiscoveries();
  return (
    <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8"><Link href="/" className="text-xs font-bold text-slate-500">TOP / AI Discoveries</Link><h1 className="mt-4 text-3xl font-black sm:text-5xl">Today&apos;s AI Discoveries</h1><p className="mt-3 text-sm text-slate-600">Price, popularity, reviews, and discovery score combine to find today&apos;s candidates.</p></div></section>
      <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{works.slice(0, 40).map((work) => <Link key={work.id} href={workDetailHref(work.id, "home")} className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 640px) 92vw, 25vw" className="object-cover transition duration-300 group-hover:scale-105" /></div><p className="mt-3 text-xs font-black text-pink-600">{work.reasonType.toUpperCase()}</p><p className="mt-1 line-clamp-2 text-sm font-black leading-5">{work.title}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{work.reason}</p><p className="mt-3 text-sm font-black text-pink-600">¥{(work.sale_price > 0 ? work.sale_price : work.price).toLocaleString("ja-JP")}</p></Link>)}</div></div>
    </main></>
  );
}
