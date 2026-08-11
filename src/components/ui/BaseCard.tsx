import { ReactNode } from "react";

type BaseCardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export default function BaseCard({
  children,
  className = "",
  onClick,
}: BaseCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-[18px]
        border
        border-zinc-800
        bg-zinc-900
        p-4
        shadow-sm
        transition-all
        duration-200
        hover:-translate-y-1
        hover:border-blue-500
        hover:shadow-lg
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}