"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/about", label: "発掘LABについて" },
  { href: "/affiliate-disclosure", label: "広告・アフィリエイトについて" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/terms", label: "利用規約" },
  { href: "/contact", label: "お問い合わせ" },
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <div>
            <p className="text-lg font-black text-white">発掘LAB</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              FANZA作品の価格・レビュー・ランキングなどを独自に分析する、18歳以上向けの情報メディアです。
              発掘LABはFANZA/DMMの公式サイトではありません。
            </p>
            <div className="mt-5 rounded-2xl border border-pink-400/20 bg-pink-400/10 p-4 text-sm leading-7">
              <p className="font-black text-pink-300">広告・アフィリエイトについて</p>
              <p className="mt-1 text-slate-300">
                当サイトのリンクを経由して商品が購入された場合、運営者に紹介料が支払われることがあります。
                表示価格・セール期間・販売状況は変わるため、購入前にFANZA公式ページで最新情報をご確認ください。
              </p>
            </div>
          </div>
          <nav aria-label="フッターナビゲーション" className="grid content-start gap-2 sm:grid-cols-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-slate-800 pt-6 text-xs leading-6 text-slate-500">
          <p>18歳未満の方は利用できません。商品の販売・決済・契約・返金はリンク先の事業者が行います。</p>
          <p className="mt-1">© 2026 発掘LAB</p>
        </div>
      </div>
    </footer>
  );
}
