import { NextResponse } from "next/server";
import {
  deleteXPostLog,
  saveXPostLog,
} from "@/lib/xPostLogs";
import { isValidPostDate, parseXPostLogPayload } from "@/lib/xPostLogPayload";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parseXPostLogPayload(payload);
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
