"use client";

import Link from "next/link";
import { Menu, Search, Heart } from "lucide-react";

const navigation = [
  { href: "/", label: "発見" },
  { href: "/ranking", label: "ランキング" },
  { href: "/sale", label: "セール" },
  { href: "/ai", label: "AI分析" },
  { href: "/search", label: "検索" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex flex-col">
          <span className="text-2xl font-black tracking-tight text-pink-600">
            発掘LAB
          </span>

          <span className="text-xs text-gray-500">
            AIで名作を発掘
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-gray-700 transition hover:text-pink-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 transition hover:bg-gray-100">
            <Search size={20} />
          </button>

          <button className="rounded-full p-2 transition hover:bg-gray-100">
            <Heart size={20} />
          </button>

          <button className="rounded-full p-2 transition hover:bg-gray-100 lg:hidden">
            <Menu size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}