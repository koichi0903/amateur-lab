import Link from "next/link";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  items: BreadcrumbItem[];
  variant?: "default" | "compact";
};

export default function Breadcrumb({ items, variant = "default" }: Props) {
  if (variant === "compact") {
    return (
      <nav className="mb-4" aria-label="パンくず">
        <ol className="flex min-w-0 flex-nowrap items-center gap-x-2 overflow-hidden text-sm">
          {items.map((item, index) => (
            <li key={index} className={`flex min-w-0 items-center gap-2 whitespace-nowrap ${index === items.length - 1 ? "flex-1" : index === 1 ? "max-w-[40%] shrink-0" : "shrink-0"}`}>
              {index > 0 && <span className="text-slate-400">/</span>}
              {item.href ? (
                <Link href={item.href} className="block min-w-0 truncate text-slate-500 transition hover:text-pink-600 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="min-w-0 truncate font-medium text-slate-700">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  return (
    <nav className="mb-8 rounded-xl border bg-white px-5 py-3 shadow-sm">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && (
  <span className="text-gray-400">›</span>
)}

            {item.href ? (
              <Link
                href={item.href}
                className="font-medium text-blue-600 hover:text-pink-500 hover:underline transition"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-gray-800">
                {item.label}
              </span>
           )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
