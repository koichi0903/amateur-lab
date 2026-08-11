import { Search } from "lucide-react";
import Header from "@/components/layout/Header";

export default function SearchLoading() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] px-4 py-20 text-center text-slate-950">
        <Search className="mx-auto animate-pulse text-pink-500" size={38} />
        <p className="mt-4 font-black">作品を検索しています…</p>
      </main>
    </>
  );
}
