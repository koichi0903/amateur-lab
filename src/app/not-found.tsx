import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ページが見つかりません | 発掘LAB",
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-black tracking-widest text-pink-600">404</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
          ページが見つかりません
        </h1>
        <p className="mt-5 text-sm leading-7 text-slate-600">
          URLが変更されたか、掲載が終了した可能性があります。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-pink-600"
          >
            トップへ戻る
          </Link>
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center justify-center border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-800 transition hover:border-pink-300 hover:text-pink-600"
          >
            作品を検索する
          </Link>
        </div>
      </div>
    </main>
  );
}
