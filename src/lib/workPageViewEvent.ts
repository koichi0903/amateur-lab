import { normalizeAffiliateSource, type AffiliateSource } from "./affiliateTracking";
import {
  isOperatorLandingPath,
  normalizeExternalAttribution,
  type ExternalAttribution,
} from "./externalAttribution";

export type WorkPageViewInsert = {
  work_id: number;
  source_page: AffiliateSource;
  price: number | null;
  discount_rate: number | null;
  discovery_score: number | null;
  ranking: number | null;
  x_post_key: string | null;
  external_channel: ExternalAttribution["channel"] | undefined;
  external_source: string | undefined;
  landing_path: string | undefined;
};

export type WorkPageViewEventResult =
  | { kind: "invalid" }
  | { kind: "ignored" }
  | { kind: "record"; eventRow: WorkPageViewInsert };

function readNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function recordPayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return null;
  return payload as Record<string, unknown>;
}

function workIdFrom(value: unknown) {
  const workId = Number(value);
  return Number.isSafeInteger(workId) && workId > 0 ? workId : null;
}

function externalAttributionFrom(event: Record<string, unknown>) {
  return normalizeExternalAttribution(
    "externalAttribution" in event ? event.externalAttribution : null,
  );
}

function xPostKeyFrom(event: Record<string, unknown>) {
  return typeof event.xPostKey === "string" && event.xPostKey.trim()
    ? event.xPostKey.trim().slice(0, 120)
    : null;
}

function eventRowFrom(
  event: Record<string, unknown>,
  workId: number,
  externalAttribution: ExternalAttribution | null,
): WorkPageViewInsert {
  return {
    work_id: workId,
    source_page: normalizeAffiliateSource(
      typeof event.sourcePage === "string" ? event.sourcePage : null,
    ),
    price: readNumber(event, "price"),
    discount_rate: readNumber(event, "discountRate"),
    discovery_score: readNumber(event, "discoveryScore"),
    ranking: readNumber(event, "ranking"),
    x_post_key: xPostKeyFrom(event),
    external_channel: externalAttribution?.channel,
    external_source: externalAttribution?.source,
    landing_path: externalAttribution?.landingPath,
  };
}

export function parseWorkPageViewEvent(payload: unknown): WorkPageViewEventResult {
  const event = recordPayload(payload);
  if (!event) return { kind: "invalid" };

  const workId = workIdFrom(event.workId);
  if (workId === null) return { kind: "invalid" };

  const externalAttribution = externalAttributionFrom(event);
  if (isOperatorLandingPath(externalAttribution?.landingPath)) return { kind: "ignored" };

  return {
    kind: "record",
    eventRow: eventRowFrom(event, workId, externalAttribution),
  };
}
