"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PublicDisclosure() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <aside className="border-b border-pink-100 bg-pink-50 px-4 py-2 text-center text-xs leading-5 text-slate-700">
      <span className="mr-2 inline-flex rounded bg-pink-600 px-1.5 py-0.5 font-black text-white">広告</span>
      当サイトは18歳以上を対象とし、アフィリエイト広告を利用しています。
      <Link href="/affiliate-disclosure" className="ml-1 font-bold text-pink-700 underline decoration-pink-300 underline-offset-2 hover:text-pink-900">
        詳細
      </Link>
    </aside>
  );
}
