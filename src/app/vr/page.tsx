import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgePercent, Glasses, ShieldCheck, Star } from "lucide-react";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import DealWorkCard, { type DealWork } from "@/components/deals/DealWorkCard";
import { supabase } from "@/lib/supabase";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 1800;

export const metadata: Metadata = pageMetadata({
  title: "VR作品ランキング | VR専用のおすすめ・セール | 発掘LAB",
  description:
    "VR機器を持っている人向けに、FANZAのVR作品だけを発掘スコア、レビュー、価格条件で紹介します。通常ランキングとは分けて掲載しています。",
  canonical: "/vr",
});

const VR_COLUMNS = [
  "id",
  "title",
  "image_url",
  "price",
  "sale_price",
  "list_price",
  "discount_rate",
  "score",
  "review_average",
  "review_count",
  "sale_end_at",
  "lowest_price",
  "is_bottom_price",
  "sample_movie_url",
].join(",");

async function getVrWorks() {
  const { data, error } = await supabase
    .from("works")
    .select(VR_COLUMNS)
    .or("genre.ilike.%VR%,title.ilike.%VR%")
    .order("score", { ascending: false, nullsFirst: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []) as unknown as DealWork[];
}

export default async function VrPage() {
  const works = await getVrWorks();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title="VR作品ランキング"
          description="VR機器を持っている人向けのVR専用作品一覧です。"
          url={`${SITE_URL}/vr`}
          items={works.map((work) => ({
            name: work.title,
            url: `${SITE_URL}/works/${work.id}`,
            image: work.image_url,
          }))}
        />

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">
              TOP / VR作品
            </Link>
            <div className="mt-5 flex max-w-4xl items-start gap-4">
              <span className="shrink-0 rounded-2xl bg-sky-50 p-3 text-sky-600">
                <Glasses size={30} />
              </span>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-sky-600">
                  VR ONLY
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  VR作品ランキング
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                  VR作品は視聴環境が必要なため、通常ランキングとは分けて掲載しています。VR機器を持っている人向けに、評価・価格・セール条件で選べる一覧です。
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-5 text-sm font-bold leading-6 text-slate-600 sm:grid-cols-3">
              <p className="flex gap-2">
                <ShieldCheck className="shrink-0 text-sky-600" size={20} />
                通常ランキングとは別枠
              </p>
              <p className="flex gap-2">
                <Star className="shrink-0 text-amber-500" size={20} />
                レビューと発掘スコアを重視
              </p>
              <p className="flex gap-2">
                <BadgePercent className="shrink-0 text-pink-600" size={20} />
                セール・過去最安も確認
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-widest text-sky-600">VR PICKS</p>
              <h2 className="mt-1 text-2xl font-black">VR専用のおすすめ作品</h2>
            </div>
            <Link href="/genre/VR%E5%B0%82%E7%94%A8" className="hidden items-center gap-1 text-sm font-black text-pink-600 hover:underline sm:flex">
              VRジャンルを見る <ArrowRight size={15} />
            </Link>
          </div>

          {works.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {works.map((work) => (
                <DealWorkCard key={work.id} work={work} source="ranking" />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center font-black">
              VR作品を集計中です
            </div>
          )}
        </section>
      </main>
    </>
  );
}
