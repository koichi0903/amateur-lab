import Link from "next/link";

type WorkCategory = "actress" | "amateur";

export default function WorkCategorySwitch({ active }: { active: WorkCategory }) {
  const categories: Array<{ id: WorkCategory; href: string; label: string }> = [
    { id: "actress", href: "/actress", label: "女優から探す" },
    { id: "amateur", href: "/amateur", label: "素人作品" },
  ];

  return (
    <nav aria-label="作品カテゴリ" className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={category.href}
          aria-current={active === category.id ? "page" : undefined}
          className={`rounded-lg px-4 py-2 text-sm font-black transition ${
            active === category.id
              ? "bg-white text-pink-700 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {category.label}
        </Link>
      ))}
    </nav>
  );
}
