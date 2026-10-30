import { stableHash } from "@/lib/myfansHash";
import type { MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import type { PublicCopyFacts } from "@/lib/myfansXExecution";
import { hasBrowserVisibleVisual, visualAnalysisForQuote } from "@/lib/myfansCreativeEvidence";

function publicMetricsFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null) {
  return {
    views: quote?.views ?? null,
    likes: quote?.likes ?? null,
    reposts: quote?.reposts ?? null,
    replies: quote?.replies ?? null,
    popularityRank: product.popularity_rank,
    productLikes: product.likes_count,
    productSaves: product.saves_count,
    price: product.price,
    isNew: product.is_new,
  };
}

function visualContextForQuote(quote: MyfansQuoteCandidate | null) {
  if (hasBrowserVisibleVisual(quote)) return quote?.media_type === "video" ? "video" : "image";
  return quote ? "public_post" : "text_only";
}

function creatorHandleForQuote(quote: MyfansQuoteCandidate | null) {
  return quote?.source_x_handle ? `@${quote.source_x_handle.replace(/^@/, "")}` : "";
}

export function publicCopyFactsFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null): PublicCopyFacts {
  return {
    sourceText: (quote?.text_excerpt ?? "").trim(),
    creatorName: product.myfans_creators?.display_name ?? "",
    creatorHandle: creatorHandleForQuote(quote),
    publicMetrics: publicMetricsFor(product, quote),
    visualContext: visualContextForQuote(quote),
    quoteVisualAnalysis: visualAnalysisForQuote(quote),
    productFacts: {
      title: product.title,
      genre: product.genre,
    },
  };
}

export function publicCopyInputHash(facts: PublicCopyFacts) {
  return `v11-${stableHash(JSON.stringify(facts))}`;
}
