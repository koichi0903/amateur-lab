import Link from "next/link";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  items: BreadcrumbItem[];
};

export default function Breadcrumb({ items }: Props) {
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