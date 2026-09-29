"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import CompareTray from "@/components/comparison/CompareTray";
import AdvancedSearchModal from "@/components/layout/AdvancedSearchModal";

const primaryMenus = [
  { href: "/sale", label: "セール" },
  { href: "/guides", label: "ガイド" },
  { href: "/search", label: "詳細検索" },
  { href: "/actress", label: "女優検索" },
  { href: "/genre", label: "ジャンル検索" },
  { href: "/maker", label: "メーカー検索" },
  { href: "/personal-pick", label: "好み発掘" },
];

export default function Header({ theme = "light" }: { theme?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const isDark = theme === "dark";

  return (
    <>
    <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${isDark ? "border-zinc-800 bg-zinc-950/95" : "border-slate-200/80 bg-white/95"}`}>
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-5 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link href="/" className="order-1 flex shrink-0 items-center gap-3" aria-label={isDark ? "FanzaAnalyzer TOP" : "発掘LAB TOP"}>
          {isDark ? <span className="text-xl font-black tracking-tight text-transparent [background:linear-gradient(90deg,#ec4899,#6366f1)] bg-clip-text lg:text-2xl">FanzaAnalyzer</span> : <Image
            src="/images/logo-horizontal-clean.png"
            alt="発掘LAB"
            width={1916}
            height={821}
            sizes="(min-width: 1024px) 192px, (min-width: 640px) 160px, 144px"
            className="h-auto w-36 object-contain sm:w-40 lg:w-48"
            priority
          />}
          {!isDark && <span className="hidden border-l border-slate-200 pl-3 text-[11px] font-bold text-slate-500 sm:block">価格で、買い時を判断する。</span>}
        </Link>

        <nav className="order-3 ml-auto hidden items-center gap-5 xl:flex">
          {primaryMenus.map((menu) => menu.href === "/search" ? <button key={menu.href} type="button" onClick={() => setAdvancedSearchOpen(true)} className={`text-sm font-bold transition hover:text-pink-400 ${isDark ? "text-zinc-400" : "text-slate-700 hover:text-pink-600"}`}>{menu.label}</button> : <Link key={menu.href} href={menu.href} className={`text-sm font-bold transition hover:text-pink-400 ${isDark ? "text-zinc-400" : "text-slate-700 hover:text-pink-600"}`}>{menu.label}</Link>)}
        </nav>

        <form action="/search" className={`order-2 ml-auto hidden h-11 w-[480px] items-center overflow-hidden rounded-full lg:flex ${isDark ? "border border-zinc-800 bg-zinc-900" : "border border-slate-200 bg-slate-50"}`}>
          <input type="search" name="q" maxLength={100} autoComplete="off" aria-label="作品・品番検索" className={`min-w-0 flex-1 bg-transparent px-4 text-sm outline-none ${isDark ? "text-zinc-200 placeholder:text-zinc-600" : "placeholder:text-slate-400"}`} placeholder="キーワード・品番で検索..." />
          <button type="submit" aria-label="ヘッダーから検索" className="flex h-full w-12 shrink-0 items-center justify-center bg-pink-600 text-white transition hover:bg-pink-500">
            <Search size={19} />
          </button>
        </form>

        <button type="button" onClick={() => setOpen((value) => !value)} className={`order-4 ml-auto rounded-xl p-2 xl:hidden ${isDark ? "text-zinc-300 hover:bg-zinc-800" : "text-slate-700 hover:bg-slate-100"}`} aria-label={open ? "メニューを閉じる" : "メニューを開く"} aria-expanded={open}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-5 pt-4 xl:hidden">
          <form action="/search" className="flex h-11 items-center rounded-full border border-slate-200 bg-slate-50 px-4 lg:hidden">
            <input type="search" name="q" maxLength={100} autoComplete="off" aria-label="作品・品番検索" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="作品・品番・女優・メーカーを検索" />
            <button type="submit" aria-label="ヘッダーから検索" className="-mr-4 flex h-full w-12 shrink-0 items-center justify-center rounded-r-full bg-pink-600 text-white transition hover:bg-pink-500">
              <Search size={17} />
            </button>
          </form>
          <nav className="mx-auto mt-3 grid max-w-[1500px] grid-cols-2 gap-1 sm:grid-cols-3">
            {primaryMenus.map((menu) => menu.href === "/search" ? <button key={menu.href} type="button" onClick={() => { setOpen(false); setAdvancedSearchOpen(true); }} className="rounded-xl px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-pink-50 hover:text-pink-600">{menu.label}</button> : <Link key={menu.href} href={menu.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-pink-50 hover:text-pink-600">{menu.label}</Link>)}
          </nav>
        </div>
      )}
    </header>
    <AdvancedSearchModal open={advancedSearchOpen} onClose={() => setAdvancedSearchOpen(false)} />
    <CompareTray />
    </>
  );
}
