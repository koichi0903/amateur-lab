import Link from "next/link";
import type { DailyDiscoveryWork } from "@/lib/getDailyDiscovery";
import type { HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import WorkImage from "../WorkImage";
import { workDetailHref } from "@/lib/affiliateTracking";

const formatPrice = (value: number | null | undefined) =>
  value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "価格未取得";

function HeroPricePanel({ priceInsight }: { priceInsight: HomePriceInsightWork }) {
  const values = priceInsight.sparkline;
  const width = 150;
  const height = 42;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="mt-5 max-w-md rounded-xl border border-white/20 bg-white/95 p-3 text-slate-950 shadow-lg backdrop-blur sm:mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-pink-600">PRICE WATCH</p>
          <p className="mt-1 text-xl font-black text-pink-600">{formatPrice(priceInsight.currentPrice)}</p>
        </div>
        <span className="rounded-full bg-pink-100 px-2 py-1 text-[11px] font-black text-pink-700">{priceInsight.badge}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-11 w-full" aria-label="価格推移" role="img">
        <polyline points={points} fill="none" stroke="#f472b6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </svg>
      <p className="text-xs font-bold text-slate-500">
        {priceInsight.previousPrice && priceInsight.dropAmount > 0
          ? `${formatPrice(priceInsight.previousPrice)}から${priceInsight.dropRate}%OFF`
          : `90日最安 ${formatPrice(priceInsight.low90Price)}`}
      </p>
    </div>
  );
}

export default function Hero({
  work,
  eyebrow = "TODAY'S PICK",
  reason,
  priceInsight,
}: {
  work: DailyDiscoveryWork | null;
  eyebrow?: string;
  reason?: string;
  priceInsight?: HomePriceInsightWork | null;
}) {
  const hasValidWorkId = work != null && Number.isInteger(work.id) && work.id > 0;

  return (
    <section className="px-4 pt-4 sm:px-6 lg:px-8">
      <div className="relative mx-auto grid min-h-[360px] max-w-[1500px] overflow-hidden rounded-[28px] bg-[#142438] px-6 py-7 shadow-[0_22px_60px_rgba(15,23,42,.18)] sm:px-10 sm:py-9 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-14 lg:py-10">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-[-45%] right-[28%] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative z-10 max-w-2xl text-white">
          <h1 className="whitespace-nowrap text-[clamp(1.625rem,7.5vw,2rem)] font-black leading-tight tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            AIが毎日名作を発掘
          </h1>
          <p className="mt-4 text-base font-bold leading-8 text-slate-200 sm:text-xl">
            あなたがまだ知らない、本当におすすめの作品がここに。
            <span className="block text-sm text-pink-100 sm:text-base">価格推移から「今が買い時」かも一緒に確認できます。</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
            <Link
              href="#daily-discovery"
              className="rounded-full bg-pink-600 px-7 py-3.5 text-sm font-black text-white transition hover:bg-pink-500"
            >
              今日のAI発掘を見る
            </Link>
            <Link href="/features" className="rounded-full border border-white/25 px-6 py-3.5 text-sm font-black text-white transition hover:border-white/60 hover:bg-white/10">特集から探す</Link>
            <Link href="/deals" className="rounded-full border border-white/25 px-6 py-3.5 text-sm font-black text-white transition hover:border-white/60 hover:bg-white/10">お得に探す</Link>
          </div>
          {priceInsight && <HeroPricePanel priceInsight={priceInsight} />}
        </div>

        <div className="relative mt-7 min-h-[240px] sm:mt-8 lg:mt-0 lg:min-h-[320px]">
          <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/15 to-white/5 shadow-2xl backdrop-blur-sm">
            {hasValidWorkId ? (
              <Link
                href={workDetailHref(work.id, "home")}
                className="group relative block h-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-pink-300"
              >
                <div className="absolute inset-0">
                {work.image_url ? (
                  <WorkImage
                    src={work.image_url}
                    alt={work.title}
                    priority
                    className="object-cover object-top opacity-80 transition duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 1024px) 100vw, 680px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-white/55">
                    AI発掘作品を準備中
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#142438] via-[#142438]/20 to-[#142438]/5" />
                <div className={`absolute inset-x-0 bottom-0 p-5 text-white sm:p-7 ${priceInsight ? "lg:max-w-[55%]" : ""}`}>
                  <p className="text-xs font-black tracking-[.18em] text-pink-300">{eyebrow}</p>
                  <p className="mt-2 line-clamp-2 text-lg font-black sm:text-2xl">{work.title}</p>
                  {reason && <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-slate-200 sm:text-sm">選定理由：{reason}</p>}
                </div>
                </div>
              </Link>
            ) : (
              <>
                {work?.image_url ? (
                  <WorkImage
                    src={work.image_url}
                    alt={work.title}
                    priority
                    className="object-cover object-top opacity-80 transition duration-500 hover:scale-[1.02]"
                    sizes="(max-width: 1024px) 100vw, 680px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-white/55">
                    AI発掘作品を準備中
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#142438] via-[#142438]/20 to-[#142438]/5" />
                {work && (
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                    <p className="text-xs font-black tracking-[.18em] text-pink-300">{eyebrow}</p>
                    <p className="mt-2 line-clamp-2 text-lg font-black sm:text-2xl">{work.title}</p>
                    {reason && <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-slate-200 sm:text-sm">選定理由：{reason}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
