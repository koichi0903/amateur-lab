import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import { editorialGuides, getEditorialGuide } from "@/lib/editorialContent";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export function generateStaticParams() {
  return editorialGuides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = getEditorialGuide((await params).slug);
  if (!guide) return {};
  return pageMetadata({ title: `${guide.title} | 発掘LAB`, description: guide.description, canonical: `/guides/${guide.slug}` });
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getEditorialGuide((await params).slug);
  if (!guide) notFound();
  const url = `${SITE_URL}/guides/${guide.slug}`;
  const jsonLd = [{ "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, url, author: { "@type": "Organization", name: "発掘LAB編集部" }, publisher: { "@type": "Organization", name: "発掘LAB" }, mainEntityOfPage: url }, { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: guide.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }];
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <article>
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[980px] px-4 py-12 sm:px-6 sm:py-16"><Link href="/guides" className="text-xs font-bold text-slate-500 hover:text-pink-600">ガイド / {guide.eyebrow}</Link><p className="mt-7 text-xs font-black tracking-widest text-indigo-600">{guide.eyebrow}</p><h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{guide.title}</h1><p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{guide.summary}</p><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500"><span>執筆・編集: 発掘LAB編集部</span><Link href="/editorial-policy" className="text-pink-700 underline">制作・更新方針</Link></div></div></header>
      <div className="mx-auto max-w-[980px] px-4 py-12 sm:px-6 lg:py-16"><div className="space-y-12">{guide.sections.map((section, index) => <section key={section.title} aria-labelledby={`section-${index}`}><p className="text-xs font-black text-indigo-600">{String(index + 1).padStart(2, "0")}</p><h2 id={`section-${index}`} className="mt-2 text-2xl font-black sm:text-3xl">{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-8 text-slate-700">{paragraph}</p>)}{section.points && <ul className="mt-5 grid gap-3 sm:grid-cols-2">{section.points.map((point) => <li key={point} className="flex gap-2 border-l-2 border-emerald-500 bg-white px-4 py-3 text-sm font-bold leading-6"><CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={16} />{point}</li>)}</ul>}</section>)}</div>
        <section className="mt-16 border-t border-slate-200 pt-10"><h2 className="text-2xl font-black">よくある質問</h2><div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 bg-white">{guide.faq.map((item) => <div key={item.question} className="px-5 py-6"><h3 className="font-black">Q. {item.question}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p></div>)}</div></section>
        <nav aria-label="関連ページ" className="mt-12"><h2 className="text-lg font-black">次に確認するページ</h2><div className="mt-4 grid gap-2 sm:grid-cols-3">{guide.related.map((link) => <Link key={link.href} href={link.href} className="flex items-center justify-between border border-slate-200 bg-white px-4 py-4 text-sm font-black hover:border-pink-300 hover:text-pink-600">{link.label}<ArrowRight size={15} /></Link>)}</div></nav>
      </div>
    </article>
  </main></>;
}
