import { ReactNode } from "react";

type GridProps = {
  children: ReactNode;
  className?: string;
};

export default function Grid({
  children,
  className = "",
}: GridProps) {
  return (
    <div
      className={`
        grid
        grid-cols-1
        gap-4
        sm:grid-cols-2
        lg:grid-cols-3
        xl:grid-cols-4
        ${className}
      `}
    >
      {children}
    </div>
  );
}