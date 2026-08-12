import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import FavoritesClient from "./FavoritesClient";

export const metadata: Metadata = {
  title: "お気に入り | 発掘LAB",
  description: "このブラウザでお気に入りに追加した作品の一覧です。",
  alternates: { canonical: "/favorites" },
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return <><Header /><main className="min-h-screen bg-slate-50 text-slate-950"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><p className="text-xs font-black tracking-[0.18em] text-pink-600">FAVORITES</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">お気に入り</h1><p className="mb-8 mt-3 text-sm leading-7 text-slate-600">このブラウザに保存した作品です。ログインは必要ありません。</p><FavoritesClient /></div></main></>;
}
