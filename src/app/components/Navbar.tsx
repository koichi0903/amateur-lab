import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-black text-white p-4 mb-6">
      <div className="flex gap-4 flex-wrap">
        <Link href="/">🏠 ホーム</Link>
        <Link href="/search">🔍 検索</Link>
        <Link href="/actress">🏆 女優</Link>
        <Link href="/genre">🏷️ ジャンル</Link>
        <Link href="/new">🆕 新着</Link>
      </div>
    </nav>
  );
}