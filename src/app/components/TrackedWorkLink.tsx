"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackWorkSelection } from "./Analytics";

export default function TrackedWorkLink({
  href,
  workId,
  title,
  itemListName,
  index,
  className,
  children,
}: {
  href: string;
  workId: number;
  title: string;
  itemListName: string;
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackWorkSelection({ workId, title, itemListName, index })}
    >
      {children}
    </Link>
  );
}
