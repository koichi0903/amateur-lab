export type Channel = {
  account: "hakkutsu_lab" | "bijyo1010";
  postKey: string;
  url: string;
};

export type Directive = {
  version: 1;
  date: string;
  experiment: string;
  hypothesis: string;
  work?: { id: number; title: string };
  evidence: string[];
  postText: string;
  visualPlan: string;
  channels: Channel[];
  primaryMetric: string;
  decisionDate: string;
};

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function hasValidDirectiveMetadata(value: Partial<Directive>): boolean {
  return value.version === 1 &&
    isDate(value.date) &&
    isDate(value.decisionDate);
}

function hasValidDirectiveContent(value: Partial<Directive>): boolean {
  return hasText(value.experiment) &&
    hasText(value.hypothesis) &&
    hasText(value.postText) && value.postText.length <= 1000 &&
    hasText(value.visualPlan) &&
    hasText(value.primaryMetric);
}

function hasValidDirectiveCollections(value: Partial<Directive>): boolean {
  return Array.isArray(value.evidence) &&
    Array.isArray(value.channels) &&
    value.channels.length >= 1 &&
    value.channels.length <= 2;
}

function hasValidDirectiveFields(value: Partial<Directive>): boolean {
  return hasValidDirectiveMetadata(value) &&
    hasValidDirectiveContent(value) &&
    hasValidDirectiveCollections(value);
}

function getWork(value: Partial<Directive>): Directive["work"] | null {
  const candidate = value.work;
  if (!candidate || !Number.isInteger(candidate.id) || candidate.id <= 0) return null;
  return { id: candidate.id, title: String(candidate.title ?? "").slice(0, 240) };
}

function hasSupportedAccount(channel: Channel): boolean {
  return channel.account === "hakkutsu_lab" || channel.account === "bijyo1010";
}

function hasValidWorkUrl(channel: Channel, workId: number): boolean {
  try {
    const url = new URL(channel.url);
    return ["http:", "https:"].includes(url.protocol) &&
      url.pathname.replace(/\/$/, "") === `/works/${workId}` &&
      url.searchParams.get("x_post") === channel.postKey &&
      url.searchParams.get("from") === "x";
  } catch {
    return false;
  }
}

function makesPostTooLong(postText: string, channel: Channel): boolean {
  const text = postText.includes("{{link}}")
    ? postText.replaceAll("{{link}}", channel.url)
    : `${postText.trimEnd()}\n\n${channel.url}`;
  return text.length > 1000;
}

function getValidChannels(value: Partial<Directive>, work: NonNullable<Directive["work"]>): Channel[] | null {
  const channels = value.channels!.filter((channel): channel is Channel =>
    hasSupportedAccount(channel) &&
    Boolean(channel.postKey?.trim()) &&
    hasValidWorkUrl(channel, work.id),
  );
  if (!channels.length || channels.some((channel) => makesPostTooLong(value.postText!, channel))) return null;
  return channels;
}

export function parseDirective(hash: string): Directive | null {
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get("directive");
  if (!raw || raw.length > 12000) return null;
  try {
    const value = JSON.parse(raw) as Partial<Directive> | null;
    if (!value || typeof value !== "object" || !hasValidDirectiveFields(value)) return null;
    const work = getWork(value);
    if (!work) return null;
    const channels = getValidChannels(value, work);
    if (!channels) return null;

    return {
      version: 1,
      date: value.date!,
      experiment: value.experiment!.trim(),
      hypothesis: value.hypothesis!.trim(),
      work,
      evidence: value.evidence!.map((item) => String(item).slice(0, 500)).slice(0, 8),
      postText: value.postText!.slice(0, 5000),
      visualPlan: value.visualPlan!.slice(0, 1200),
      channels,
      primaryMetric: value.primaryMetric!.slice(0, 300),
      decisionDate: value.decisionDate!,
    };
  } catch {
    return null;
  }
}
