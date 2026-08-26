"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Copy, Download, Image as ImageIcon } from "lucide-react";
import type { XChartPoint, XPostCandidate } from "@/lib/xPostPlanner";

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 630;
const FONT_FAMILY = "Arial, 'Yu Gothic', 'Meiryo', sans-serif";

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[character] ?? character);
}

function formatPrice(value: number | null) {
  return value ? `¥${value.toLocaleString("ja-JP")}` : "価格は詳細で確認";
}

function formatDate(value: string | null) {
  if (!value) return "--/--";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function wrapText(value: string, length: number, maxLines: number) {
  const chars = Array.from(value.replace(/\s+/g, " ").trim());
  const lines: string[] = [];
  while (chars.length && lines.length < maxLines) lines.push(chars.splice(0, length).join(""));
  if (chars.length && lines.length) lines[lines.length - 1] = `${lines.at(-1)?.slice(0, -1)}…`;
  return lines;
}

function observationDays(candidate: XPostCandidate) {
  if (!candidate.seriesStartedAt) return 0;
  return Math.max(0, Math.floor(
    (new Date(candidate.checkedAt).getTime() - new Date(candidate.seriesStartedAt).getTime()) / 86_400_000,
  ));
}

type ChartGeometry = {
  path: string;
  points: Array<{ x: number; y: number }>;
  min: number;
  max: number;
};

function chartGeometry(points: XChartPoint[]): ChartGeometry {
  const prices = points.map((point) => point.price);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const rawRange = rawMax - rawMin;
  const padding = rawRange > 0 ? Math.max(20, rawRange * 0.18) : Math.max(50, rawMax * 0.08);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const range = Math.max(1, max - min);
  const startX = 540;
  const width = 575;
  const top = 205;
  const height = 218;
  const times = points.map((point) => new Date(point.changedAt).getTime());
  const firstTime = Math.min(...times);
  const lastTime = Math.max(...times);
  const timeRange = Math.max(1, lastTime - firstTime);
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? startX + width : startX + ((times[index] - firstTime) / timeRange) * width,
    y: top + ((max - point.price) / range) * height,
  }));
  const path = coords.reduce((value, point, index) => {
    if (!index) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const previous = coords[index - 1];
    return `${value} L ${point.x.toFixed(1)} ${previous.y.toFixed(1)} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");
  return { path, points: coords, min, max };
}

function buildSvg(candidate: XPostCandidate) {
  const hasChart = candidate.chartPoints.length >= 2;
  const hasDrop = Boolean(
    candidate.previousPrice && candidate.currentPrice && candidate.previousPrice > candidate.currentPrice,
  );
  const dropAmount = hasDrop ? candidate.previousPrice! - candidate.currentPrice! : 0;
  const dropRate = hasDrop ? Math.round((dropAmount / candidate.previousPrice!) * 100) : 0;
  const isLongWindow = observationDays(candidate) >= 80;
  const accent = hasDrop ? "#ec4899" : candidate.category === "new" ? "#0891b2" : "#7c3aed";
  const paleAccent = hasDrop ? "#fce7f3" : candidate.category === "new" ? "#cffafe" : "#ede9fe";
  const eyebrow = hasDrop ? "PRICE DROP" : candidate.category === "new" ? "NEW DISCOVERY" : "AI DISCOVERY";
  const headline = hasDrop ? "価格が動いた。今チェックしたい一作" : "AIが見つけた、今日の比較候補";
  const status = hasDrop
    ? candidate.isNinetyDayLow ? (isLongWindow ? "過去90日最安" : "取得期間内の最安") : "値下げを確認"
    : candidate.label;
  const titleLines = wrapText(candidate.title, 38, 2);
  const period = candidate.seriesPeriod
    ? `${candidate.seriesName ?? "価格系列"}（${candidate.seriesPeriod}）`
    : candidate.seriesName ?? "";
  const chart = hasChart ? chartGeometry(candidate.chartPoints) : null;
  const lastPoint = chart?.points.at(-1);
  const current = formatPrice(candidate.currentPrice);
  const previous = formatPrice(candidate.previousPrice);
  const chartMinimum = candidate.seriesMinimumPrice ?? (hasChart ? Math.min(...candidate.chartPoints.map((point) => point.price)) : null);
  const chartMaximum = candidate.seriesMaximumPrice ?? (hasChart ? Math.max(...candidate.chartPoints.map((point) => point.price)) : null);
  const metric = hasDrop ? `${formatPrice(dropAmount)} DOWN` : `SCORE ${candidate.score}`;
  const previousY = hasDrop && candidate.previousPrice && chart
    ? 205 + ((chart.max - candidate.previousPrice) / Math.max(1, chart.max - chart.min)) * 218
    : null;

  const chartMarkup = chart ? `
    <rect x="510" y="153" width="650" height="318" rx="18" fill="#f8fafc" stroke="#dbe4ee"/>
    <text x="540" y="188" font-family="${FONT_FAMILY}" font-size="18" font-weight="800" fill="#0f172a">実際の価格推移</text>
    <text x="1128" y="188" text-anchor="end" font-family="${FONT_FAMILY}" font-size="14" font-weight="700" fill="#64748b">${candidate.seriesObservationCount}回観測 / 同一販売形式・期間</text>
    <line x1="540" y1="205" x2="1115" y2="205" stroke="#dbe4ee"/>
    <line x1="540" y1="314" x2="1115" y2="314" stroke="#dbe4ee" stroke-dasharray="5 7"/>
    <line x1="540" y1="423" x2="1115" y2="423" stroke="#dbe4ee"/>
    <text x="530" y="211" text-anchor="end" font-family="${FONT_FAMILY}" font-size="13" fill="#64748b">${formatPrice(chartMaximum)}</text>
    <text x="530" y="428" text-anchor="end" font-family="${FONT_FAMILY}" font-size="13" fill="#64748b">${formatPrice(chartMinimum)}</text>
    ${previousY !== null ? `<line x1="540" y1="${previousY.toFixed(1)}" x2="1115" y2="${previousY.toFixed(1)}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="7 7"/><text x="1108" y="${Math.max(213, previousY - 9).toFixed(1)}" text-anchor="end" font-family="${FONT_FAMILY}" font-size="13" font-weight="700" fill="#64748b">以前 ${previous}</text>` : ""}
    <path d="${chart.path}" fill="none" stroke="${accent}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
    ${lastPoint ? `<circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="10" fill="white" stroke="${accent}" stroke-width="6"/><rect x="${Math.min(1000, Math.max(548, lastPoint.x - 76))}" y="${Math.max(210, lastPoint.y - 54)}" width="138" height="36" rx="9" fill="${accent}"/><text x="${Math.min(1069, Math.max(617, lastPoint.x - 7))}" y="${Math.max(234, lastPoint.y - 30)}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="16" font-weight="900" fill="white">現在 ${current}</text>` : ""}
    <text x="540" y="454" font-family="${FONT_FAMILY}" font-size="13" fill="#64748b">${formatDate(candidate.chartPoints.at(0)?.changedAt ?? null)}</text>
    <text x="1115" y="454" text-anchor="end" font-family="${FONT_FAMILY}" font-size="13" fill="#64748b">${formatDate(candidate.checkedAt)}</text>` : `
    <rect x="510" y="153" width="650" height="318" rx="18" fill="#f8fafc" stroke="#dbe4ee"/>
    <text x="540" y="190" font-family="${FONT_FAMILY}" font-size="18" font-weight="800" fill="#0f172a">AI発掘データ</text>
    <rect x="540" y="222" width="180" height="174" rx="14" fill="white" stroke="#e2e8f0"/>
    <rect x="735" y="222" width="180" height="174" rx="14" fill="white" stroke="#e2e8f0"/>
    <rect x="930" y="222" width="180" height="174" rx="14" fill="white" stroke="#e2e8f0"/>
    <text x="630" y="267" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="15" font-weight="700" fill="#64748b">現在価格</text>
    <text x="630" y="329" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="31" font-weight="900" fill="${accent}">${current}</text>
    <text x="825" y="267" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="15" font-weight="700" fill="#64748b">発掘スコア</text>
    <text x="825" y="329" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="45" font-weight="900" fill="${accent}">${candidate.score}</text>
    <text x="1020" y="267" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="15" font-weight="700" fill="#64748b">レビュー</text>
    <text x="1020" y="329" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="35" font-weight="900" fill="${accent}">${candidate.reviewAverage ? candidate.reviewAverage.toFixed(1) : "--"}</text>
    <text x="1020" y="361" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="14" fill="#64748b">${candidate.reviewCount}件</text>
    <text x="540" y="440" font-family="${FONT_FAMILY}" font-size="15" fill="#64748b">十分な価格履歴がないため、価格変動は描画していません</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
    <rect width="1200" height="630" fill="#eaf0f6"/>
    <rect x="24" y="24" width="1152" height="582" rx="22" fill="white" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="24" y="24" width="1152" height="96" rx="22" fill="#10243a"/>
    <rect x="24" y="94" width="1152" height="26" fill="#10243a"/>
    <circle cx="69" cy="69" r="20" fill="${accent}"/>
    <text x="69" y="76" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="22" font-weight="900" fill="white">発</text>
    <text x="101" y="62" font-family="${FONT_FAMILY}" font-size="20" font-weight="900" fill="white">発掘LAB</text>
    <text x="101" y="86" font-family="${FONT_FAMILY}" font-size="13" font-weight="800" fill="#9fb1c5">PRICE INTELLIGENCE</text>
    <text x="360" y="76" font-family="${FONT_FAMILY}" font-size="28" font-weight="900" fill="white">${headline}</text>
    <rect x="950" y="50" width="182" height="42" rx="21" fill="${accent}"/>
    <text x="1041" y="78" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="16" font-weight="900" fill="white">${escapeXml(status)}</text>

    <text x="65" y="166" font-family="${FONT_FAMILY}" font-size="15" font-weight="900" fill="${accent}" letter-spacing="1.5">${eyebrow}</text>
    ${hasDrop ? `
      <text x="65" y="225" font-family="${FONT_FAMILY}" font-size="20" font-weight="700" fill="#64748b">以前</text>
      <text x="65" y="270" font-family="${FONT_FAMILY}" font-size="35" font-weight="800" fill="#64748b" text-decoration="line-through">${previous}</text>
      <text x="65" y="325" font-family="${FONT_FAMILY}" font-size="20" font-weight="900" fill="${accent}">↓ ${formatPrice(dropAmount)} / ${dropRate}% 下落</text>
      <text x="65" y="393" font-family="${FONT_FAMILY}" font-size="20" font-weight="700" fill="#0f172a">現在</text>
      <text x="65" y="449" font-family="${FONT_FAMILY}" font-size="58" font-weight="900" fill="${accent}">${current}</text>` : `
      <rect x="65" y="201" width="400" height="238" rx="18" fill="${paleAccent}"/>
      <text x="92" y="242" font-family="${FONT_FAMILY}" font-size="17" font-weight="800" fill="${accent}">${escapeXml(candidate.label)}</text>
      <text x="92" y="305" font-family="${FONT_FAMILY}" font-size="54" font-weight="900" fill="#0f172a">${metric}</text>
      <text x="92" y="354" font-family="${FONT_FAMILY}" font-size="22" font-weight="800" fill="#334155">現在 ${current}</text>
      <text x="92" y="401" font-family="${FONT_FAMILY}" font-size="16" fill="#64748b">価格・評価・人気をまとめて比較</text>`}

    ${chartMarkup}
    <line x1="64" y1="493" x2="1136" y2="493" stroke="#dbe4ee"/>
    ${titleLines.map((line, index) => `<text x="65" y="${531 + index * 29}" font-family="${FONT_FAMILY}" font-size="21" font-weight="900" fill="#0f172a">${escapeXml(line)}</text>`).join("")}
    <text x="1135" y="529" text-anchor="end" font-family="${FONT_FAMILY}" font-size="14" font-weight="700" fill="#475569">${escapeXml(period || "販売形式は詳細ページで確認")}</text>
    <text x="1135" y="558" text-anchor="end" font-family="${FONT_FAMILY}" font-size="13" fill="#64748b">${formatCheckedAt(candidate.checkedAt)} 時点</text>
    <text x="65" y="589" font-family="${FONT_FAMILY}" font-size="12" fill="#94a3b8">価格・販売状況は変わる場合があります。購入前にFANZA公式ページで最新情報をご確認ください。</text>
  </svg>`;
}

function svgDataUrl(candidate: XPostCandidate) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSvg(candidate))}`;
}

async function svgToPng(candidate: XPostCandidate) {
  const blob = new Blob([buildSvg(candidate)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("画像を生成できませんでした"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = SVG_WIDTH;
    canvas.height = SVG_HEIGHT;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (png) => png ? resolve(png) : reject(new Error("PNGを生成できませんでした")),
      "image/png",
    ));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function XCreativeAsset({ candidate }: { candidate: XPostCandidate }) {
  const [status, setStatus] = useState<"idle" | "copied" | "downloaded" | "error">("idle");
  const previewUrl = useMemo(() => svgDataUrl(candidate), [candidate]);
  const hasVerifiedChart = candidate.chartPoints.length >= 2;

  async function copyImage() {
    try {
      const png = await svgToPng(candidate);
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("画像コピー非対応");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function downloadImage() {
    try {
      const png = await svgToPng(candidate);
      const url = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = url;
      link.download = `x-${candidate.workId}-${candidate.category}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("downloaded");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black text-zinc-200"><ImageIcon size={14} /> 補足リプ添付画像</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {hasVerifiedChart
              ? `${candidate.seriesName ?? "価格"}${candidate.seriesPeriod ? `（${candidate.seriesPeriod}）` : ""} / 90日内${candidate.seriesObservationCount}件`
              : "履歴不足のため、下落を描かないAI発掘カード"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyImage} className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-[11px] font-black hover:border-pink-500 hover:text-pink-200">
            {status === "copied" ? <Check size={13} /> : <Copy size={13} />} 画像コピー
          </button>
          <button type="button" onClick={downloadImage} className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-[11px] font-black hover:border-sky-500 hover:text-sky-200">
            <Download size={13} /> PNG保存
          </button>
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800 bg-slate-100">
        <Image
          src={previewUrl}
          alt={`${candidate.title}のX投稿用完成画像`}
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          unoptimized
          className="h-auto w-full"
        />
      </div>
      {status === "copied" && <p className="mt-2 text-[11px] font-bold text-emerald-300">画像をクリップボードへコピーしました。</p>}
      {status === "downloaded" && <p className="mt-2 text-[11px] font-bold text-sky-300">1200×630pxのPNGを保存しました。</p>}
      {status === "error" && <p className="mt-2 text-[11px] font-bold text-amber-300">ブラウザが画像コピーに対応していません。PNG保存を使ってください。</p>}
    </div>
  );
}
