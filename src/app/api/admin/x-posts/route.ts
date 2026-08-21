import { NextResponse } from "next/server";
import {
  deleteXPostLog,
  saveXPostLog,
  type XPostLogInput,
} from "@/lib/xPostLogs";
import type { XPostCandidate } from "@/lib/xPostCandidates";

const categories = new Set<XPostCandidate["category"]>([
  "sales",
  "deal",
  "score",
  "new",
]);

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
