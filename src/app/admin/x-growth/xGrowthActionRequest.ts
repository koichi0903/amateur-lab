"use client";

export async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
  return data as Record<string, unknown>;
}
