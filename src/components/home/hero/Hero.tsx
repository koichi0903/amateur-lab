import Link from "next/link";
import type { Work } from "@/types/work";
import WorkImage from "../WorkImage";

export default function Hero({ work }: { work: Work | null }) {
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
          </p>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
            <Link
              href="#daily-discovery"
              className="rounded-full bg-pink-600 px-7 py-3.5 text-sm font-black text-white transition hover:bg-pink-500"
            >
              今日のAI発掘を見る
            </Link>
          </div>
        </div>

        <div className="relative mt-7 min-h-[240px] sm:mt-8 lg:mt-0 lg:min-h-[320px]">
          <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/15 to-white/5 shadow-2xl backdrop-blur-sm">
            {hasValidWorkId ? (
              <Link
                href={`/works/${work.id}`}
                aria-label={`${work.title}の作品詳細を見る`}
                className="group block h-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-pink-300"
              >
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
                <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                  <p className="text-xs font-black tracking-[.18em] text-pink-300">TODAY&apos;S PICK</p>
                  <p className="mt-2 line-clamp-2 text-lg font-black sm:text-2xl">{work.title}</p>
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
                    <p className="text-xs font-black tracking-[.18em] text-pink-300">TODAY&apos;S PICK</p>
                    <p className="mt-2 line-clamp-2 text-lg font-black sm:text-2xl">{work.title}</p>
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
