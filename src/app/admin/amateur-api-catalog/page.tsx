import Link from "next/link";
import AmateurApiCatalogScan from "@/app/admin/amateur-api-catalog/AmateurApiCatalogScan";

export const dynamic = "force-dynamic";

export default function AmateurApiCatalogPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-5 text-white sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="text-sm font-bold text-zinc-400 hover:text-white">← 管理画面へ</Link>
        <h1 className="mt-5 text-3xl font-black">FANZA素人 API全作品取得</h1>
        <p className="mt-2 text-sm text-zinc-400">DMM APIの作品データを漏らさず保存するための手動カタログ収集画面です。</p>
        <div className="mt-7"><AmateurApiCatalogScan /></div>
      </div>
    </main>
  );
}
