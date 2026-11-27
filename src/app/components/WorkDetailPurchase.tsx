"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import AffiliateLink from "./AffiliateLink";

type WorkDetailPurchaseContextValue = {
  price: number | null;
  setPrice: Dispatch<SetStateAction<number | null>>;
};

const WorkDetailPurchaseContext = createContext<WorkDetailPurchaseContextValue | null>(null);

export function WorkDetailPurchaseProvider({
  initialPrice,
  children,
}: {
  initialPrice: number | null;
  children: ReactNode;
}) {
  const [price, setPrice] = useState<number | null>(initialPrice);

  return (
    <WorkDetailPurchaseContext.Provider value={{ price, setPrice }}>
      {children}
    </WorkDetailPurchaseContext.Provider>
  );
}

export function useWorkDetailPurchasePrice() {
  const value = useContext(WorkDetailPurchaseContext);
  if (!value) throw new Error("WorkDetailPurchaseProvider is missing");
  return value;
}

export function WorkDetailPurchaseCta({
  workId,
  href,
}: {
  workId: number;
  href: string;
}) {
  const { price } = useWorkDetailPurchasePrice();

  return (
    <div className="mt-6 border-y border-slate-200 py-5">
      <AffiliateLink
        href={href}
        workId={workId}
        placement="detail-sidebar"
        sourcePage="direct"
        ariaLabel={"作品ID " + workId + "をFANZAで購入する"}
        className="flex min-h-14 w-full items-center justify-center rounded-lg bg-pink-600 px-4 py-3 text-base font-black text-white shadow-sm hover:bg-pink-700"
      >
        FANZAで購入する{price != null && price > 0 ? ` ¥${price.toLocaleString("ja-JP")}` : ""}
      </AffiliateLink>
    </div>
  );
}
