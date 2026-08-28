"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import CompareTray from "@/components/comparison/CompareTray";

const menus = [
  { href: "/compare", label: "比較" },
  { href: "/ranking", label: "ランキング" },
  { href: "/new", label: "新着" },
  { href: "/sale", label: "セール" },
  { href: "/deals", label: "お得に探す" },
  { href: "/features", label: "特集" },
  { href: "/guides", label: "ガイド" },
  { href: "/reports", label: "データ" },
  { href: "/actress", label: "女優" },
  { href: "/maker", label: "メーカー" },
  { href: "/series", label: "シリーズ" },
  { href: "/genre", label: "ジャンル" },
  { href: "/favorites", label: "お気に入り" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-5 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="発掘LAB TOP">
          <Image
            src="/images/logo-horizontal-clean.png"
            alt="発掘LAB"
            width={1916}
            height={821}
            sizes="(min-width: 1024px) 192px, (min-width: 640px) 160px, 144px"
            className="h-auto w-36 object-contain sm:w-40 lg:w-48"
            priority
          />
          <span className="hidden border-l border-slate-200 pl-3 text-[11px] font-bold text-slate-500 sm:block">AIが毎日、名作を発掘する。</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-4 xl:flex">
          {menus.map((menu) => <Link key={menu.href} href={menu.href} className="text-sm font-bold text-slate-700 transition hover:text-pink-600">{menu.label}</Link>)}
        </nav>

        <form action="/search" className="ml-auto hidden h-11 w-[310px] items-center rounded-full border border-slate-200 bg-slate-50 px-4 lg:flex xl:ml-3">
          <button type="submit" aria-label="ヘッダーから検索" className="shrink-0 text-slate-400 transition hover:text-pink-600">
            <Search size={17} />
          </button>
          <input type="search" name="q" maxLength={100} autoComplete="off" aria-label="作品検索" className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="作品・女優・メーカーを検索" />
        </form>

        <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto rounded-xl p-2 text-slate-700 hover:bg-slate-100 xl:hidden" aria-label={open ? "メニューを閉じる" : "メニューを開く"} aria-expanded={open}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-5 pt-4 xl:hidden">
          <form action="/search" className="flex h-11 items-center rounded-full border border-slate-200 bg-slate-50 px-4 lg:hidden">
            <button type="submit" aria-label="ヘッダーから検索" className="shrink-0 text-slate-400 transition hover:text-pink-600">
              <Search size={17} />
            </button>
            <input type="search" name="q" maxLength={100} autoComplete="off" aria-label="作品検索" className="ml-2 w-full bg-transparent text-sm outline-none" placeholder="作品・女優・メーカーを検索" />
          </form>
          <nav className="mx-auto mt-3 grid max-w-[1500px] grid-cols-2 gap-1 sm:grid-cols-3">
            {menus.map((menu) => <Link key={menu.href} href={menu.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-pink-50 hover:text-pink-600">{menu.label}</Link>)}
          </nav>
        </div>
      )}
    </header>
    <CompareTray />
    </>
  );
}
