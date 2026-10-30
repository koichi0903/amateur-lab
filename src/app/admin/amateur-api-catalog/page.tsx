import Link from "next/link";
import AmateurApiCatalogScan from "@/app/admin/amateur-api-catalog/AmateurApiCatalogScan";
import FanzaAmateurMp4Completion from "@/app/admin/amateur-api-catalog/FanzaAmateurMp4Completion";

export const dynamic = "force-dynamic";

export default function AmateurApiCatalogPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-5 text-white sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="text-sm font-bold text-zinc-400 hover:text-white">← 管理画面へ</Link>
        <h1 className="mt-5 text-3xl font-black">FANZA素人 作品補完</h1>
        <p className="mt-2 text-sm text-zinc-400">日次の新作補完と週次の全作品再照合を別々に管理します。</p>
        <div className="mt-7"><AmateurApiCatalogScan /></div>
        <div className="mt-7"><FanzaAmateurMp4Completion /></div>
      </div>
    </main>
  );
}
