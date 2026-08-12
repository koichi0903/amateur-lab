"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const COOKIE_NAME = "hakkutsu_age_verified";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export default function AgeGate() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) {
      setIsOpen(false);
      return;
    }

    const accepted = document.cookie
      .split(";")
      .some((cookie) => cookie.trim() === `${COOKIE_NAME}=1`);

    if (accepted) setIsOpen(false);
  }, [isAdmin]);

  useEffect(() => {
    if (!isOpen || isAdmin) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAdmin, isOpen]);

  if (!isOpen || isAdmin) return null;

  const accept = () => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=1; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 px-5 py-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-description"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 text-center text-white shadow-2xl sm:p-10"
      >
        <p className="mb-3 text-sm font-bold tracking-widest text-pink-400">
          発掘LAB
        </p>
        <h2 id="age-gate-title" className="text-3xl font-black">
          年齢確認
        </h2>
        <div
          id="age-gate-description"
          className="mt-5 space-y-2 text-sm leading-7 text-slate-300"
        >
          <p>このサイトには成人向けの商品情報・画像が含まれます。</p>
          <p className="font-bold text-white">18歳未満の方は利用できません。</p>
        </div>

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={accept}
            className="min-h-12 rounded-full bg-pink-600 px-6 py-3 font-bold text-white transition hover:bg-pink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
          >
            18歳以上です
          </button>
          <button
            type="button"
            onClick={() => window.location.replace("https://www.google.com/")}
            className="min-h-12 rounded-full border border-slate-600 px-6 py-3 font-bold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            退出する
          </button>
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-400">
          「18歳以上です」を選択すると、18歳以上であることを確認したものとします。
        </p>
      </section>
    </div>
  );
}
