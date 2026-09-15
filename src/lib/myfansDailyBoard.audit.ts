import "dotenv/config";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { buildMyfansExecutionBoard, detectPublicCopyLeak } from "@/lib/myfansXExecution";

async function main() {
  const analytics = await getMyfansAnalytics({ approvedMediaId: 1 });
  if (analytics.error) throw new Error(analytics.error);
  const board = buildMyfansExecutionBoard(analytics, { planDate: "2026-09-08", operationDay: 1 });
  const publicTexts = [
    ...board.candidates.flatMap((candidate) => [candidate.body, candidate.selfReply]),
    ...board.outboundTasks.map((task) => task.suggestedText),
    board.profileGuide.bio,
    board.profileGuide.pinnedPost,
  ].filter(Boolean);
  const leaks = publicTexts.map((text) => ({ text, leak: detectPublicCopyLeak(text) })).filter((row) => row.leak.hasLeak);
  const average = board.candidates.length
    ? board.candidates.reduce((sum, candidate) => sum + candidate.quality.total, 0) / board.candidates.length
    : 0;
  console.log(JSON.stringify({
    planDate: board.planDate,
    planKey: board.planKey,
    posts: board.candidates.map((candidate) => ({
      slot: candidate.plannedSlot,
      postType: candidate.postType,
      creativeStrategy: candidate.creativeStrategy,
      quality: candidate.quality,
      quoteXUrl: candidate.quoteXUrl,
      body: candidate.body,
      selfReply: candidate.selfReply,
    })),
    averageQuality: Number(average.toFixed(1)),
    held: board.heldCandidates.map((candidate) => ({
      slot: candidate.plannedSlot,
      postType: candidate.postType,
      quality: candidate.quality.total,
      reasons: candidate.quality.reasons,
    })),
    outbound: board.outboundTasks.map((task) => ({
      type: task.type,
      targetUrl: task.targetUrl,
      reason: task.reason,
      suggestedText: task.suggestedText,
      guardrail: task.guardrail,
    })),
    profile: board.profileGuide,
    leaks,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
