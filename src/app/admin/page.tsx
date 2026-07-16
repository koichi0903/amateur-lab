import Link from "next/link";

const menus = [
  {
    title: "🔄 更新管理",
    description: "作品更新・ジョブ状況を確認",
    href: "/admin/update",
  },
  {
    title: "📊 統計",
    description: "ランキング・集計データ",
    href: "/admin/statistics",
  },
  {
    title: "⚙️ 設定",
    description: "システム設定",
    href: "/admin/settings",
  },
];

export default function AdminDashboard() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl p-10">
        <div className="mb-10">
          <h1 className="text-5xl font-black tracking-wide">
            発掘LAB
          </h1>

          <p className="mt-2 text-lg text-zinc-400">
            ADMIN CONTROL PANEL
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {menus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="
                rounded-2xl
                border
                border-zinc-800
                bg-zinc-900
                p-8
                transition
                hover:border-purple-500
                hover:shadow-2xl
                hover:shadow-purple-900/40
              "
            >
              <h2 className="text-2xl font-bold">
                {menu.title}
              </h2>

              <p className="mt-3 text-zinc-400">
                {menu.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-16 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
          発掘LAB v1.0
        </div>
      </div>
    </main>
  );
}