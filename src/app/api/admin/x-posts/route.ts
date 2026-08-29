import { NextResponse } from "next/server";
import {
  deleteXPostLog,
  saveXPostLog,
  type XPostLogInput,
} from "@/lib/xPostLogs";
import type { XPostCandidate } from "@/lib/xPostPlanner";

const categories = new Set<XPostCandidate["category"]>([
  "sales",
  "deal",
  "hidden_gem",
  "score",
  "new",
  "today_buy",
  "today_discovery",
  "actress_best",
  "genre_best",
  "maker_best",
  "series_best",
]);
const hookTypes = new Set<XPostCandidate["hookType"]>([
  "price_anomaly",
  "rating_anomaly",
  "ranking_anomaly",
  "review_proof",
  "discovery_anomaly",
  "buy_timing",
]);
const imageStrategies = new Set<XPostCandidate["imageStrategy"]>(["original_work_image", "branded_data_card"]);
const linkStrategies = new Set<XPostCandidate["linkStrategy"]>(["body_link", "reply_link"]);
const ctaStrategies = new Set<XPostCandidate["ctaStrategy"]>(["price_cta", "reason_cta"]);

function isValidPostDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parsePayload(payload: unknown): XPostLogInput | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Record<string, unknown>;
  const postKey = typeof candidate.postKey === "string" ? candidate.postKey : "";
  const workId = Number(candidate.workId);
  const category = typeof candidate.category === "string" ? candidate.category : "";
  const title = typeof candidate.title === "string" ? candidate.title : "";
  const postText = typeof candidate.postText === "string" ? candidate.postText : "";
  const postDate = typeof candidate.postDate === "string" ? candidate.postDate : "";
  const creativeVariantId = typeof candidate.creativeVariantId === "string" ? candidate.creativeVariantId : null;
  const hookType = typeof candidate.hookType === "string" && hookTypes.has(candidate.hookType as XPostCandidate["hookType"])
    ? candidate.hookType as XPostCandidate["hookType"]
    : null;
  const imageStrategy = typeof candidate.imageStrategy === "string" && imageStrategies.has(candidate.imageStrategy as XPostCandidate["imageStrategy"])
    ? candidate.imageStrategy as XPostCandidate["imageStrategy"]
    : null;
  const linkStrategy = typeof candidate.linkStrategy === "string" && linkStrategies.has(candidate.linkStrategy as XPostCandidate["linkStrategy"])
    ? candidate.linkStrategy as XPostCandidate["linkStrategy"]
    : null;
  const ctaStrategy = typeof candidate.ctaStrategy === "string" && ctaStrategies.has(candidate.ctaStrategy as XPostCandidate["ctaStrategy"])
    ? candidate.ctaStrategy as XPostCandidate["ctaStrategy"]
    : null;

  if (
    !postKey ||
    !Number.isSafeInteger(workId) ||
    workId <= 0 ||
    !categories.has(category as XPostCandidate["category"]) ||
    !title ||
    !postText ||
    !isValidPostDate(postDate)
  ) {
    return null;
  }

  return {
    postKey: postKey.slice(0, 120),
    workId,
    category: category as XPostCandidate["category"],
    title: title.slice(0, 300),
    postText: postText.slice(0, 1000),
    postDate,
    creativeVariantId: creativeVariantId?.slice(0, 160) ?? null,
    hookType,
    imageStrategy,
    linkStrategy,
    ctaStrategy,
  };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parsePayload(payload);
  if (!input) {
    return NextResponse.json({ error: "Invalid X post log" }, { status: 400 });
  }

  const { error } = await saveXPostLog(input);
  if (error) {
    console.error("[x-posts] failed to save X post log", {
      postKey: input.postKey,
      workId: input.workId,
      code: error.code,
    });
    return NextResponse.json({ error: "Failed to save X post log" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid X post log" }, { status: 400 });
  }

  const candidate = payload as Record<string, unknown>;
  const postKey = typeof candidate.postKey === "string" ? candidate.postKey : "";
  const postDate = typeof candidate.postDate === "string" ? candidate.postDate : "";

  if (!postKey || !isValidPostDate(postDate)) {
    return NextResponse.json({ error: "Invalid X post log" }, { status: 400 });
  }

  const { error } = await deleteXPostLog(postKey, postDate);
  if (error) {
    console.error("[x-posts] failed to delete X post log", {
      postKey,
      postDate,
      code: error.code,
    });
    return NextResponse.json({ error: "Failed to delete X post log" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
