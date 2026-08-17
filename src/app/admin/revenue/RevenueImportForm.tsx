"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, LoaderCircle } from "lucide-react";

function currentJstMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date()).slice(0, 7);
}

type ImportResult = {
  imported: number;
  matched: number;
  unmatched: number;
  totalCommission: number;
};

export default function RevenueImportForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/revenue/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "取込に失敗しました。");

      setMessage(
        `${payload.imported.toLocaleString("ja-JP")}商品を取込（作品紐付け ${payload.matched.toLocaleString("ja-JP")}件／未紐付け ${payload.unmatched.toLocaleString("ja-JP")}件、報酬合計 ¥${payload.totalCommission.toLocaleString("ja-JP")}）`,
      );
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "取込に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)_auto]">
      <label className="grid gap-1.5 text-xs font-bold text-zinc-400">
        対象月
        <input
          type="month"
          name="reportMonth"
          defaultValue={currentJstMonth()}
          required
          className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-pink-500"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-bold text-zinc-400">
        FANZA 商品別レポートCSV
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:border-0 file:bg-transparent file:font-bold file:text-pink-400"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-black text-white transition hover:bg-pink-500 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="animate-spin" size={17} /> : <FileUp size={17} />}
        {pending ? "取込中" : "CSVを取込"}
      </button>
      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`text-sm leading-6 lg:col-span-3 ${isError ? "text-red-300" : "text-emerald-300"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
