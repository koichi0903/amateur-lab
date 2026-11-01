import Link from "next/link";
import { BlueskySampleConsole } from "./BlueskySampleConsole";

export const dynamic = "force-dynamic";

export default function BlueskySamplePreparationPage() {
  return <main className="min-h-screen bg-zinc-950 p-6 text-white md:p-10">
    <div className="mx-auto max-w-7xl">
      <Link href="/admin" className="text-sm text-cyan-300">← ADMIN</Link>
      <header className="mt-4">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-sky-300">Bluesky用 素材準備</p>
        <h1 className="mt-2 text-4xl font-black">公式サンプル画像・動画</h1>
        <p className="mt-2 text-zinc-400">品番から保存済みの公式サンプルを読み込み、画像を選ぶか動画の指定範囲を切り抜いて保存します。</p>
      </header>
      <BlueskySampleConsole />
    </div>
  </main>;
}

