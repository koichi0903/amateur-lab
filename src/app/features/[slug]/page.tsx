import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import DealWorkCard from "@/components/deals/DealWorkCard";
import Header from "@/components/layout/Header";
import { featureCategories, isFeatureCategory } from "@/lib/features";
import { getFeatureWorks } from "@/lib/getFeatureWorks";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 1800;
const PAGE_SIZE = 30;

export function generateStaticParams() {
  return Object.keys(featureCategories).map((slug) => ({ slug }));
}

function parsePage(value?: string) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isFeatureCategory(slug)) return {};
  const page = parsePage((await searchParams).page);
  const feature = featureCategories[slug];
  return pageMetadata({
    title: `${feature.title}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: feature.description,
    canonical: page > 1 ? `/features/${slug}?page=${page}` : `/features/${slug}`,
  });
}

export default async function FeaturePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  if (!isFeatureCategory(slug)) notFound();
  const page = parsePage((await searchParams).page);
  const offset = (page - 1) * PAGE_SIZE;
  const feature = featureCategories[slug];
  const Icon = feature.icon;
  const result = await getFeatureWorks(slug, offset, offset + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil(result.count / PAGE_SIZE));
  const canonicalPath = `/features/${slug}${page > 1 ? `?page=${page}` : ""}`;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title={feature.title}
          description={feature.description}
          url={`${SITE_URL}${canonicalPath}`}
          items={result.works.map((work) => ({
            name: work.title,
            url: `${SITE_URL}/works/${work.id}`,
            image: work.image_url,
          }))}
        />
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/features" className="text-xs font-bold text-slate-500 hover:text-pink-600">
              特集 <span className="mx-1">/</span> {feature.label}
            </Link>
            <div className="mt-5 flex max-w-4xl items-start gap-4">
              <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><Icon size={30} /></span>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-indigo-600">EDITORIAL PICKS</p>
                <h1 className="mt-2 text-3xl font-black sm:text-5xl">{feature.title}</h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{feature.description}</p>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-10 grid gap-3 rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-3">
            <div className="rounded-2xl bg-indigo-50 p-5"><p className="text-xs font-black tracking-widest text-indigo-600">こんな方へ</p><ul className="mt-3 space-y-2 text-sm font-bold leading-6 text-slate-700">{feature.forWhom.map((item) => <li key={item}>✓ {item}</li>)}</ul></div>
            <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-black tracking-widest text-slate-600">選定基準</p><ul className="mt-3 space-y-2 text-sm font-bold leading-6 text-slate-700">{feature.selectionPoints.map((item) => <li key={item}>✓ {item}</li>)}</ul></div>
            <div className="rounded-2xl bg-amber-50 p-5"><p className="text-xs font-black tracking-widest text-amber-700">確認ポイント</p><p className="mt-3 text-sm font-bold leading-7 text-slate-700">{feature.caution}</p></div>
          </div>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div><p className="text-xs font-black tracking-widest text-pink-600">RECOMMENDED</p><h2 className="mt-1 text-2xl font-black">おすすめ作品</h2></div>
            <span className="text-xs font-bold text-slate-500">全{result.count.toLocaleString("ja-JP")}作品</span>
          </div>
          {result.error ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center font-black">作品を読み込めませんでした</div>
          ) : result.works.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {result.works.map((work) => <DealWorkCard key={work.id} work={work} source="features" />)}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center font-black">現在、条件に合う作品はありません</div>
          )}
          {totalPages > 1 && (
            <nav aria-label="ページ送り" className="mt-10 flex items-center justify-center gap-3">
              {page > 1 && <Link href={page === 2 ? `/features/${slug}` : `/features/${slug}?page=${page - 1}`} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black"><ArrowLeft size={15} />前へ</Link>}
              <span className="text-xs font-bold text-slate-500">{page} / {totalPages}</span>
              {page < totalPages && <Link href={`/features/${slug}?page=${page + 1}`} className="flex items-center gap-1 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">次へ<ArrowRight size={15} /></Link>}
            </nav>
          )}
        </section>
      </main>
    </>
  );
}
