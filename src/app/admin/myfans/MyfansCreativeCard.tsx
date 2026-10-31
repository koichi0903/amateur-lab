"use client";

import type { buildMyfansExecutionBoard } from "@/lib/myfansXExecution";

type ExecutionCandidate = ReturnType<typeof buildMyfansExecutionBoard>["candidates"][number];

type CardPayload = Record<string, unknown>;

function payloadText(payload: CardPayload, key: string) {
  return String(payload[key] ?? "");
}

export function buildCreativeCardCopy(payload: CardPayload, productTitle = "") {
  const title = payloadText(payload, "title");
  return {
    subtitle: payloadText(payload, "subtitle") || "myfans発掘・比較",
    headline: payloadText(payload, "headline") || title || "見るポイントは1つ",
    primary: payloadText(payload, "primary") || payloadText(payload, "angle"),
    audience: payloadText(payload, "audienceLine") || payloadText(payload, "audience"),
    chips: ["chip1", "chip2", "chip3"].map((key) => payloadText(payload, key)).filter(Boolean),
    check: payloadText(payload, "check"),
    title: title || productTitle || "",
    footer: payloadText(payload, "footer") || "myfans発掘・比較",
  };
}

const canvasPaletteByStrategy: Record<string, { accent: string; accentSoft: string }> = {
  ranking_card: { accent: "#d97706", accentSoft: "#fef3c7" },
  comparison_card: { accent: "#0369a1", accentSoft: "#e0f2fe" },
};

const previewToneByStrategy: Record<string, { bar: string; soft: string; text: string }> = {
  ranking_card: { bar: "bg-amber-600", soft: "bg-amber-100", text: "text-amber-800" },
  comparison_card: { bar: "bg-sky-700", soft: "bg-sky-100", text: "text-sky-800" },
};

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const char of chars) {
    const next = `${line}${char}`;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length >= maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((row, index) => context.fillText(index === maxLines - 1 && chars.join("").length > lines.join("").length ? `${row.slice(0, -1)}...` : row, x, y + index * lineHeight));
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function downloadCardPng(candidate: ExecutionCandidate) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を作れませんでした。text onlyで投稿してください。");
  const payload = (candidate.cardPayload ?? {}) as CardPayload;
  const kind = candidate.creativeStrategy;
  const copy = buildCreativeCardCopy(payload, candidate.product?.title);
  const palette = canvasPaletteByStrategy[kind] ?? { accent: "#059669", accentSoft: "#dcfce7" };
  const { accent, accentSoft } = palette;
  const dark = "#111827";
  context.fillStyle = "#fafafa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accentSoft;
  context.fillRect(0, 0, canvas.width, 150);
  context.fillStyle = accent;
  context.fillRect(0, 0, 28, canvas.height);

  context.fillStyle = dark;
  context.font = "900 34px sans-serif";
  context.fillText(copy.subtitle, 72, 72);
  context.fillStyle = dark;
  context.font = "900 72px sans-serif";
  wrapCanvasText(context, copy.headline, 72, 145, 900, 78, 2);

  context.fillStyle = "#ffffff";
  roundRect(context, 72, 214, 708, 220, 20);
  context.fill();
  context.strokeStyle = "#e5e7eb";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = dark;
  context.font = "900 38px sans-serif";
  wrapCanvasText(context, copy.primary, 104, 280, 632, 48, 3);
  context.fillStyle = "#4b5563";
  context.font = "700 25px sans-serif";
  wrapCanvasText(context, copy.audience, 104, 390, 620, 32, 2);

  copy.chips.forEach((chip, index) => {
    const x = 72 + index * 224;
    context.fillStyle = accent;
    roundRect(context, x, 470, 196, 58, 16);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "900 24px sans-serif";
    wrapCanvasText(context, chip, x + 22, 508, 152, 26, 1);
  });

  context.fillStyle = dark;
  roundRect(context, 830, 214, 300, 314, 20);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "900 28px sans-serif";
  context.fillText("見る前チェック", 860, 268);
  context.fillStyle = accentSoft;
  context.font = "800 28px sans-serif";
  wrapCanvasText(context, copy.check, 860, 330, 230, 40, 3);
  context.fillStyle = "#d1d5db";
  context.font = "700 21px sans-serif";
  wrapCanvasText(context, copy.title, 860, 468, 230, 28, 2);

  context.fillStyle = "#334155";
  context.font = "900 24px sans-serif";
  context.fillText(copy.footer, 72, 632);
  context.font = "700 20px sans-serif";
  context.fillText("画像・サムネ・動画不使用 / テキスト情報のみ", 760, 632);
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${candidate.creativeVariantId || "myfans-card"}.png`;
  link.click();
}

export function CreativeCardPreview({ candidate }: { candidate: ExecutionCandidate }) {
  const payload = (candidate.cardPayload ?? {}) as CardPayload;
  const kind = candidate.creativeStrategy;
  const copy = buildCreativeCardCopy(payload, candidate.product?.title);
  const tone = previewToneByStrategy[kind] ?? { bar: "bg-emerald-700", soft: "bg-emerald-100", text: "text-emerald-800" };
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-700 bg-neutral-50 text-zinc-950 shadow-sm">
      <div className={`h-2 ${tone.bar}`} />
      <div className={`${tone.soft} px-5 py-4`}>
        <p className={`text-xs font-black ${tone.text}`}>{copy.subtitle}</p>
        <p className="mt-2 text-2xl font-black leading-8">{copy.headline}</p>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div>
          <p className="text-lg font-black leading-7">{copy.primary}</p>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">{copy.audience}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {copy.chips.map((chip) => (
              <span key={chip} className={`rounded-md px-3 py-1.5 text-xs font-black ${tone.soft} ${tone.text}`}>{chip}</span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-950 p-4 text-white">
          <p className="text-xs font-black text-zinc-400">見る前チェック</p>
          <p className="mt-2 text-sm font-black leading-6">{copy.check}</p>
          <p className="mt-4 text-xs leading-5 text-zinc-400">{copy.title}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-zinc-200 px-5 py-3 text-xs font-bold text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <span>{copy.footer}</span>
        <span>1200x675 PNG / 素材画像不使用</span>
      </div>
    </div>
  );
}

