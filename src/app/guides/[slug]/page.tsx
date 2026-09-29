import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShoppingCart } from "lucide-react";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import { analyzerGuideArticles, getAnalyzerGuide } from "@/lib/analyzerGuideContent";
import { editorialGuides, getEditorialGuide } from "@/lib/editorialContent";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export function generateStaticParams() {
  return [...analyzerGuideArticles, ...editorialGuides].map((guide) => ({ slug: guide.slug }));
}

function getGuide(slug: string) {
  return getAnalyzerGuide(slug) ?? getEditorialGuide(slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  return pageMetadata({ title: `${guide.title} | 発掘LAB`, description: guide.description, canonical: `/guides/${guide.slug}` });
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const analyzerGuide = getAnalyzerGuide(guide.slug);
  const url = `${SITE_URL}/guides/${guide.slug}`;
  const jsonLd = [{ "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, url, author: { "@type": "Organization", name: "発掘LAB編集部" }, publisher: { "@type": "Organization", name: "発掘LAB" }, mainEntityOfPage: url }, { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: guide.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }];

  if (!analyzerGuide) {
    return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><article><header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[980px] px-4 py-12 sm:px-6 sm:py-16"><Link href="/guides" className="text-xs font-bold text-slate-500 hover:text-pink-600">ガイド / {guide.eyebrow}</Link><p className="mt-7 text-xs font-black tracking-widest text-indigo-600">{guide.eyebrow}</p><h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{guide.title}</h1><p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{guide.summary}</p></div></header><div className="mx-auto max-w-[980px] px-4 py-12 sm:px-6 lg:py-16"><div className="space-y-12">{guide.sections.map((section, index) => <section key={section.title}><p className="text-xs font-black text-indigo-600">{String(index + 1).padStart(2, "0")}</p><h2 className="mt-2 text-2xl font-black">{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-8 text-slate-700">{paragraph}</p>)}{section.points && <ul className="mt-5 grid gap-3 sm:grid-cols-2">{section.points.map((point) => <li key={point} className="flex gap-2 border-l-2 border-emerald-500 bg-white px-4 py-3 text-sm font-bold leading-6"><CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={16} />{point}</li>)}</ul>}</section>)}</div></div></article></main></>;
  }

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><article className="mx-auto max-w-[740px] px-4 py-5 sm:px-6 sm:py-7">
    <div className="inline-flex rounded border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">広告・PR</div>
    <nav aria-label="パンくず" className="mt-4 text-xs text-slate-500"><Link href="/" className="hover:text-pink-600">ホーム</Link><span className="mx-2">/</span><Link href="/guides" className="hover:text-pink-600">ガイド</Link></nav>
    <header className="mt-5"><h1 className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{guide.title}</h1><p className="mt-2 text-xs text-slate-500">最終更新：2026年4月</p>{(analyzerGuide.intro ?? [guide.summary]).map((paragraph) => <p key={paragraph} className="mt-5 text-sm leading-7 text-slate-700">{paragraph}</p>)}</header>
    {analyzerGuide.inlineCta && <aside className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-pink-200 bg-pink-50 p-4"><div><p className="text-[10px] font-black tracking-widest text-pink-600">PR</p><p className="mt-1 text-xs text-slate-700">{analyzerGuide.inlineCta.body}</p></div><a href={analyzerGuide.inlineCta.href} target="_blank" rel="sponsored noopener noreferrer" className="shrink-0 rounded-md bg-pink-600 px-4 py-2.5 text-xs font-black text-white hover:bg-pink-500">{analyzerGuide.inlineCta.label}</a></aside>}
    {analyzerGuide.topLinks && <div className="mt-5 grid gap-2 sm:grid-cols-2">{analyzerGuide.topLinks.map((link) => <Link key={link.href} href={link.href} className="rounded-md bg-pink-600 px-4 py-3 text-center text-xs font-black text-white hover:bg-pink-500">{link.label}</Link>)}</div>}
    <div className="mt-6 space-y-8">{guide.sections.map((section) => <section key={section.title}><h2 className="text-lg font-black text-slate-950">{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-700">{paragraph}</p>)}{section.points && <ul className="mt-4 space-y-2">{section.points.map((point, pointIndex) => <li key={point} className="flex gap-2 rounded-md border border-slate-200 bg-white px-3 py-3 text-xs leading-6 text-slate-700"><span className="shrink-0 font-black text-pink-600">{section.title.includes("手順") || section.title.includes("傾向") ? `${pointIndex + 1}` : "✓"}</span>{point}</li>)}</ul>}{analyzerGuide.steps?.filter((step) => step.sectionTitle === section.title).map((step) => <div key={step.title} className="mt-5"><h3 className="text-sm font-black text-slate-950"><span className="mr-2 text-pink-600">{step.title.match(/^\d+|^①|^②|^③|^④|^⑤/)?.[0]}</span>{step.title.replace(/^\d+\s|^①\s|^②\s|^③\s|^④\s|^⑤\s/, "")}</h3><p className="mt-2 text-sm leading-7 text-slate-700">{step.body}</p></div>)}</section>)}</div>
    {analyzerGuide.serviceLinks && <section className="mt-9"><h2 className="text-lg font-black text-slate-950">公式ページでサービスを確認する</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{analyzerGuide.serviceLinks.map((serviceLink) => <a key={serviceLink.href} href={serviceLink.href} target="_blank" rel="sponsored noopener noreferrer" className="rounded-md border border-pink-200 bg-white px-4 py-3 text-xs font-black text-pink-600 hover:border-pink-400 hover:bg-pink-50">{serviceLink.label}</a>)}</div></section>}
    {analyzerGuide.internalLinks && <section className="mt-9"><h2 className="text-lg font-black text-slate-950">発掘LABでVR作品を探す</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{analyzerGuide.internalLinks.map((internalLink) => <Link key={internalLink.href} href={internalLink.href} className="rounded-md border border-pink-200 bg-white px-4 py-3 text-xs font-black text-pink-600 hover:border-pink-400 hover:bg-pink-50">{internalLink.label}</Link>)}</div></section>}
    {analyzerGuide.cta && <aside className="mt-9 rounded-lg border border-pink-200 bg-pink-50 p-5"><p className="text-[10px] font-black tracking-widest text-pink-600">{analyzerGuide.cta.eyebrow}</p><h2 className="mt-2 text-base font-black text-slate-950">{analyzerGuide.cta.title}</h2><p className="mt-2 text-xs leading-6 text-slate-700">{analyzerGuide.cta.body}</p><a href={analyzerGuide.cta.href} target="_blank" rel="sponsored noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-md bg-pink-600 px-4 py-2.5 text-xs font-black text-white hover:bg-pink-500"><ShoppingCart size={14} />{analyzerGuide.cta.label}</a></aside>}
    <section className="mt-9"><h2 className="text-lg font-black text-slate-950">よくある質問</h2><div className="mt-4 space-y-2">{guide.faq.map((item) => <div key={item.question} className="rounded-md border border-slate-200 bg-white px-4 py-4"><h3 className="text-sm font-black text-slate-950">Q. {item.question}</h3><p className="mt-2 text-xs leading-6 text-slate-600">A. {item.answer}</p></div>)}</div></section>
    <nav aria-label="関連ページ" className="mt-9 border-t border-slate-200 pt-6"><h2 className="text-sm font-black text-slate-950">関連記事</h2><div className="mt-3 space-y-2">{guide.related.map((link) => <Link key={link.href} href={link.href} className="flex items-center gap-1 text-xs font-bold text-pink-600 hover:text-pink-500">→ {link.label}<ArrowRight size={12} /></Link>)}</div></nav>
  </article></main></>;
}
