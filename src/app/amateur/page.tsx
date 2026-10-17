import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Hero from "@/components/home/hero/Hero";
import AmateurHomeSections from "@/components/catalog/AmateurHomeSections";
import { getFanzaAmateurHomeSections } from "@/lib/dmm/fanzaAmateurCatalog";
import { pageMetadata } from "@/lib/seo";

// Refresh the landing page every three hours so ended campaigns disappear without hourly churn.
export const revalidate = 10_800;

export const metadata: Metadata = pageMetadata({
  title: "FANZA素人作品｜人気・セール・新着 | 発掘LAB",
  description: "FANZA公式APIで取得した素人作品を、レビュー・キャンペーン・新着から探せます。",
  canonical: "/amateur",
});

export default async function AmateurPage() {
  let sections: Awaited<ReturnType<typeof getFanzaAmateurHomeSections>> | null = null;
  let errorMessage: string | null = null;

  try {
    sections = await getFanzaAmateurHomeSections();
  } catch (error) {
    console.error("[fanza-amateur] home load failed", error instanceof Error ? error.message : "unknown");
    errorMessage = error instanceof Error ? error.message : "素人作品を読み込めませんでした。";
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Hero activeCatalog="amateur" />

        {errorMessage ? (
          <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
            <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
              <p className="font-black">素人作品を読み込めませんでした</p>
              <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
            </div>
          </section>
        ) : sections ? (
          <AmateurHomeSections sections={sections} />
        ) : null}
      </main>
    </>
  );
}
