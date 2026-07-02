import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        {/* ロゴ */}
        <Link
          href="/"
          className="text-3xl font-black tracking-tight"
        >
          🔬 発掘LAB
        </Link>

        {/* メニュー */}
        <div className="flex gap-3 flex-wrap">

          <Link
            href="/ranking"
            className="px-3 py-2 rounded-lg hover:bg-indigo-100"
          >
            📊 発掘ランキング
          </Link>

          <Link
            href="/search"
            className="px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            🔍 作品検索
          </Link>

          <Link
            href="/actress"
            className="px-3 py-2 rounded-lg hover:bg-pink-100"
          >
            👩 女優
          </Link>

          <Link
            href="/genre"
            className="px-3 py-2 rounded-lg hover:bg-blue-100"
          >
            🏷 ジャンル
          </Link>

          <Link
            href="/new"
            className="px-3 py-2 rounded-lg hover:bg-green-100"
          >
            🆕 新着
          </Link>

          
        </div>

      </div>
    </nav>
  );
}