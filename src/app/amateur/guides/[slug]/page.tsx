import type { Metadata } from "next";
import GuideDetailPage from "@/app/guides/[slug]/page";
import { analyzerGuideArticles, getAnalyzerGuide } from "@/lib/analyzerGuideContent";
import { editorialGuides, getEditorialGuide } from "@/lib/editorialContent";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return [...analyzerGuideArticles, ...editorialGuides].map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = (await params).slug;
  const article = getAnalyzerGuide(guide) ?? getEditorialGuide(guide);
  if (!article) return {};
  return pageMetadata({ title: `${article.title} | 発掘LAB`, description: article.description, canonical: `/guides/${article.slug}`, robots: { index: false, follow: true } });
}

export default async function AmateurGuideDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  return <GuideDetailPage params={params} basePath="/amateur/guides" />;
}
