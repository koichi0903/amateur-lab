import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-4">

        <Link
          href="/"
          className="text-2xl font-black"
        >
          🔬 発掘LAB
        </Link>

        <nav className="flex gap-6 text-sm font-bold">

          <Link href="/ranking">
            発掘ランキング
          </Link>

          <Link href="/search">
            作品検索
          </Link>

          <Link href="/actress">
            女優
          </Link>

          <Link href="/genre">
            ジャンル
          </Link>

          <Link href="/new">
            新着
          </Link>

        </nav>

      </div>
    </header>
  );
}