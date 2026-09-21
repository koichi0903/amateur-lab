export type CompleteThreadLink = {
  url: string;
  source: "parent" | "own_reply";
  statusUrl: string;
  confidence: "exact" | "strong" | "unknown";
};

type ThreadPost = {
  statusUrl: string;
  authorHandle: string;
  hasMedia: boolean;
  myfansUrls: string[];
  isReply: boolean;
};

export type CompleteThreadResult =
  | { status: "FOUND_COMPLETE_THREAD"; link: CompleteThreadLink }
  | { status: "NO_MEDIA" | "NO_OWN_MYFANS_LINK" | "THREAD_NOT_FULLY_OBSERVED" | "LINK_UNRESOLVED"; link?: CompleteThreadLink };

function sameAuthor(left: string, right: string) {
  return left.replace(/^@/, "").toLowerCase() === right.replace(/^@/, "").toLowerCase();
}

function linkConfidence(url: string, resolvedMyfansPostUrl?: string | null): CompleteThreadLink["confidence"] {
  if (/^https:\/\/(?:www\.)?myfans\.jp\/posts\/[0-9a-f-]+$/i.test(url)) return "exact";
  if (resolvedMyfansPostUrl && /^https:\/\/(?:www\.)?myfans\.jp\/posts\/[0-9a-f-]+$/i.test(resolvedMyfansPostUrl)) return "exact";
  return /^https:\/\/(?:www\.)?mfco\.link\//i.test(url) ? "strong" : "unknown";
}

export function completeThreadEvidence(input: {
  sourceAuthorHandle: string;
  parent: ThreadPost;
  ownReplies: ThreadPost[];
  fullyObserved: boolean;
  resolvedMyfansPostUrl?: string | null;
}): CompleteThreadResult {
  if (!input.parent.hasMedia) return { status: "NO_MEDIA" };
  const parentUrl = input.parent.myfansUrls[0];
  if (parentUrl) {
    return { status: "FOUND_COMPLETE_THREAD", link: { url: parentUrl, source: "parent", statusUrl: input.parent.statusUrl, confidence: linkConfidence(parentUrl, input.resolvedMyfansPostUrl) } };
  }
  const ownReply = input.ownReplies.find((reply) => reply.isReply && sameAuthor(reply.authorHandle, input.sourceAuthorHandle) && reply.myfansUrls.length > 0);
  if (!ownReply) return input.fullyObserved ? { status: "NO_OWN_MYFANS_LINK" } : { status: "THREAD_NOT_FULLY_OBSERVED" };
  const url = ownReply.myfansUrls[0];
  const link = { url, source: "own_reply" as const, statusUrl: ownReply.statusUrl, confidence: linkConfidence(url, input.resolvedMyfansPostUrl) };
  return link.confidence === "unknown" ? { status: "LINK_UNRESOLVED", link } : { status: "FOUND_COMPLETE_THREAD", link };
}

export function isCompleteThreadCandidate(input: { mediaType?: string | null; threadCollectionStatus?: string | null; myfansLinkSource?: string | null; myfansUrls?: string[] }) {
  return (input.mediaType === "image" || input.mediaType === "video")
    && input.threadCollectionStatus === "FOUND_COMPLETE_THREAD"
    && Boolean(input.myfansUrls?.length)
    && (input.myfansLinkSource === "parent" || input.myfansLinkSource === "own_reply");
}
