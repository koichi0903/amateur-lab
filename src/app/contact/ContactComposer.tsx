"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const categories = [
  "掲載情報の訂正",
  "権利に関する連絡",
  "プライバシー",
  "サイトの不具合",
  "その他",
] as const;

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function ContactComposer() {
  const [category, setCategory] = useState<(typeof categories)[number]>(categories[0]);
  const [name, setName] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState.status === "sending") return;

    setSubmitState({ status: "sending" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name,
          replyEmail,
          targetUrl,
          details,
          consent,
          website,
          startedAt: startedAt.current,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "送信できませんでした。時間をおいて再度お試しください。");
      }

      setName("");
      setReplyEmail("");
      setTargetUrl("");
      setDetails("");
      setConsent(false);
      setWebsite("");
      startedAt.current = Date.now();
      setSubmitState({ status: "success", message: "お問い合わせを受け付けました。内容を確認してご連絡します。" });
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "送信できませんでした。時間をおいて再度お試しください。",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <label className="block text-sm font-black text-slate-700">
        お問い合わせ種別
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}
          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold"
        >
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-black text-slate-700">
          お名前（任意）
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoComplete="name"
            className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
        <label className="block text-sm font-black text-slate-700">
          返信先メールアドレス
          <input
            type="email"
            value={replyEmail}
            onChange={(event) => setReplyEmail(event.target.value)}
            maxLength={254}
            autoComplete="email"
            required
            className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
      </div>

      <label className="block text-sm font-black text-slate-700">
        対象ページURL（任意）
        <input
          type="url"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          maxLength={1000}
          placeholder="https://hakkutsu-lab.com/..."
          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
        />
      </label>

      <label className="block text-sm font-black text-slate-700">
        お問い合わせ内容
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          minLength={20}
          maxLength={5000}
          rows={7}
          required
          placeholder="該当箇所や希望する対応を具体的にご記入ください（20文字以上）"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6"
        />
      </label>

      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
          className="mt-1 h-4 w-4 rounded border-slate-300 accent-pink-600"
        />
        <span>入力した個人情報が、本人確認・内容の調査・返信・不正利用防止のために利用されることに同意します。</span>
      </label>

      <button
        type="submit"
        disabled={submitState.status === "sending"}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-pink-600 px-7 py-3 font-black text-white transition hover:bg-pink-500 disabled:cursor-wait disabled:opacity-60"
      >
        {submitState.status === "sending" ? "送信中…" : "お問い合わせを送信"}
      </button>

      <div aria-live="polite" role="status" className="min-h-6 text-sm font-bold">
        {submitState.status === "success" ? <p className="text-emerald-700">{submitState.message}</p> : null}
        {submitState.status === "error" ? <p className="text-red-700">{submitState.message}</p> : null}
      </div>
      <p className="text-xs leading-5 text-slate-500">通常は内容を確認後に返信します。購入・決済・視聴・キャンセルはFANZA公式サポートへお問い合わせください。</p>
    </form>
  );
}
