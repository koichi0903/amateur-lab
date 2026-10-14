"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { jstDateDaysAgo } from "@/lib/jstDate";

const rewardTypes = [
  { key: "direct", label: "ダイレクト成果" },
  { key: "category", label: "カテゴリ成果" },
  { key: "service", label: "サービス新規" },
] as const;

export default function FanzaId990DailyOfficialInput() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const numeric = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    };
    const payload = {
      reportDate: String(form.get("reportDate") ?? ""),
      reportStatus: String(form.get("reportStatus") ?? "confirmed"),
      clickCount: numeric("clickCount"),
      directRewardCount: numeric("directRewardCount"),
      directRewardYen: numeric("directRewardYen"),
      categoryRewardCount: numeric("categoryRewardCount"),
      categoryRewardYen: numeric("categoryRewardYen"),
      serviceRewardCount: numeric("serviceRewardCount"),
      serviceRewardYen: numeric("serviceRewardYen"),
      notes: String(form.get("notes") ?? ""),
    };
    try {
      const response = await fetch("/api/admin/revenue/fanza-id990-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "保存できませんでした。");
      setMessage("ID990の日別公式値を記録しました。0も公式画面で確認した値として保存しました。");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 rounded-xl border border-emerald-900 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-emerald-100">ID990の日別公式レポートを記録</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">DMMアフィリエイトでID「990」を選び、対象日の日別レポートの値を入力します。今日の値は翌日反映のため入力できません。未確認欄を0のまま保存しないよう、確認できた数値を入力してください。確定して0件だった場合だけ0を入力します。</p>
        </div>
        <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs font-black text-emerald-200">ID 990 固定</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-bold text-zinc-400">対象日
          <input type="date" name="reportDate" max={jstDateDaysAgo(1)} defaultValue={jstDateDaysAgo(1)} required className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">確定状態
          <select name="reportStatus" defaultValue="" required className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white">
            <option value="" disabled>状態を選択</option>
            <option value="confirmed">確定値</option>
            <option value="provisional">速報・未確定</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">公式クリック数
          <input type="number" name="clickCount" min="0" max="2147483647" step="1" required placeholder="確認した数値" className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">メモ（任意）
          <input name="notes" maxLength={500} placeholder="例：DMM ID990 日別レポート" className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white" />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {rewardTypes.map(({ key, label }) => (
          <fieldset key={key} className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 p-3">
            <legend className="px-1 text-xs font-black text-zinc-300">{label}</legend>
            <label className="grid gap-1 text-[11px] text-zinc-500">成果件数
              <input type="number" name={`${key}RewardCount`} min="0" max="2147483647" step="1" required placeholder="確認した件数" className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-white" />
            </label>
            <label className="grid gap-1 text-[11px] text-zinc-500">報酬額（円）
              <input type="number" name={`${key}RewardYen`} min="0" max="2147483647" step="1" required placeholder="確認した金額" className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-white" />
            </label>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-black text-black disabled:opacity-50">{pending ? "保存中…" : "公式日次データを保存"}</button>
        {message && <p role={isError ? "alert" : "status"} className={`text-xs leading-5 ${isError ? "text-rose-300" : "text-emerald-300"}`}>{message}</p>}
      </div>
    </form>
  );
}
