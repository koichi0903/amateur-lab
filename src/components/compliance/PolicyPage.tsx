import type { ReactNode } from "react";
import Header from "@/components/layout/Header";

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-black text-slate-950 sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-8 text-slate-700 sm:text-base">{children}</div>
    </section>
  );
}

export default function PolicyPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-16">
          <p className="text-xs font-black tracking-[0.18em] text-pink-600">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">{description}</p>
          <p className="mt-3 text-xs text-slate-400">最終更新日：2026年8月17日</p>
          <div className="mt-10 space-y-6">{children}</div>
        </div>
      </main>
    </>
  );
}
