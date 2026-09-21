import assert from "node:assert/strict";
import { completeThreadEvidence, isCompleteThreadCandidate } from "./myfansCompleteThread.ts";

const parent = { statusUrl: "https://x.com/creator/status/574", authorHandle: "creator", hasMedia: true, myfansUrls: [], isReply: false };
const ownReply = { statusUrl: "https://x.com/creator/status/575", authorHandle: "creator", hasMedia: false, myfansUrls: ["https://mfco.link/r/abc"], isReply: true };

assert.equal(completeThreadEvidence({ sourceAuthorHandle: "creator", parent, ownReplies: [ownReply], fullyObserved: true }).status, "FOUND_COMPLETE_THREAD");
assert.equal(completeThreadEvidence({ sourceAuthorHandle: "creator", parent: { ...parent, myfansUrls: ["https://myfans.jp/posts/03ba5744-5376-47e7-94bb-d3b1f7ceeb99"] }, ownReplies: [], fullyObserved: true }).status, "FOUND_COMPLETE_THREAD");
assert.equal(completeThreadEvidence({ sourceAuthorHandle: "creator", parent, ownReplies: [{ ...ownReply, authorHandle: "other" }], fullyObserved: true }).status, "NO_OWN_MYFANS_LINK");
assert.equal(completeThreadEvidence({ sourceAuthorHandle: "creator", parent: { ...parent, hasMedia: false }, ownReplies: [ownReply], fullyObserved: true }).status, "NO_MEDIA");
assert.equal(completeThreadEvidence({ sourceAuthorHandle: "creator", parent, ownReplies: [ownReply], fullyObserved: false }).status, "THREAD_NOT_FULLY_OBSERVED");
assert.equal(completeThreadEvidence({ sourceAuthorHandle: "creator", parent, ownReplies: [{ ...ownReply, myfansUrls: ["https://t.co/unknown"] }], fullyObserved: true }).status, "LINK_UNRESOLVED");
assert.equal(isCompleteThreadCandidate({ mediaType: "image", threadCollectionStatus: "FOUND_COMPLETE_THREAD", myfansLinkSource: "own_reply", myfansUrls: ["https://mfco.link/r/abc"] }), true);
assert.equal(isCompleteThreadCandidate({ mediaType: "none", threadCollectionStatus: "FOUND_COMPLETE_THREAD", myfansLinkSource: "parent", myfansUrls: ["https://mfco.link/r/abc"] }), false);

console.log("Complete-thread evidence checks passed (574/575 fixtures)");
