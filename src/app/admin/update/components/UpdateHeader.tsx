import Link from "next/link";

export default function UpdateHeader() {
  return (
    <div className="mb-10 flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-black tracking-wide text-white">
          🔄 更新管理
        </h1>

        <p className="mt-2 text-zinc-400">
          Update Manager
        </p>
      </div>

      <Link
        href="/admin"
        className="rounded-xl border border-zinc-700 px-5 py-3 text-white transition hover:border-purple-500 hover:bg-zinc-900"
      >
        ← 管理画面へ戻る
      </Link>
    </div>
  );
}