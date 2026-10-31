"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Lightbulb } from "lucide-react";
import { parseDirective, type Channel, type Directive } from "@/lib/x-growth/xGrowthOperatorDirective";

export default function OperatorPostDirective() {
  const [directive, setDirective] = useState<Directive | null>(null);
  const [copied, setCopied] = useState("");
  const [registered, setRegistered] = useState<Record<string, string>>({});
  const [registering, setRegistering] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const load = () => {
      const hash = window.location.hash;
      const parsed = parseDirective(hash);
      setDirective(parsed);
      setInvalid(hash.includes("directive=") && !parsed);
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? "" : current), 1800);
    } catch {
      setCopied("");
    }
  };

  const copyPostForChannel = (channel: Channel) => {
    if (!directive) return;
    void copy(`post:${channel.account}`, postTextForChannel(channel));
  };

  const postTextForChannel = (channel: Channel) => directive?.postText.includes("{{link}}")
    ? directive.postText.replaceAll("{{link}}", channel.url)
    : `${directive?.postText.trimEnd() ?? ""}\n\n${channel.url}`;

  const registerTask = async (channel: Channel) => {
    if (!directive || registering) return;
    const key = `${channel.account}:${channel.postKey}`;
    setRegistering(key);
    setRegistered((current) => ({ ...current, [key]: "" }));
    try {
      const response = await fetch("/api/admin/x-growth/operator-post-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: channel.account,
          postKey: channel.postKey,
          workId: directive.work?.id,
          title: directive.work?.title || directive.experiment,
          postText: postTextForChannel(channel),
          postDate: directive.date,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; alreadyExists?: boolean } | null;
      if (!response.ok) throw new Error(payload?.error || "投稿タスクを登録できませんでした。");
      setRegistered((current) => ({ ...current, [key]: payload?.alreadyExists ? "登録済みです。投稿後にX投稿URLを入力してください。" : "登録しました。投稿後にX投稿URLを入力してください。" }));
    } catch (error) {
      setRegistered((current) => ({ ...current, [key]: error instanceof Error ? error.message : "投稿タスクを登録できませんでした。" }));
    } finally {
      setRegistering("");
    }
  };

  return (
    <section aria-labelledby="operator-post-directive" className="rounded-2xl border border-fuchsia-700 bg-fuchsia-950/20 p-5 shadow-lg shadow-fuchsia-950/20 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Lightbulb className="text-fuchsia-300" size={20} />
        <p className="text-xs font-black tracking-[0.16em] text-fuchsia-200">OPERATOR BRIEF / 投稿指示</p>
        <span className="ml-auto rounded-full border border-fuchsia-800 px-2.5 py-1 text-[10px] font-black text-fuchsia-100">自動投稿なし</span>
      </div>
      <h2 id="operator-post-directive" className="mt-2 text-2xl font-black">今日の運営指示</h2>

      {invalid ? (
        <p role="alert" className="mt-4 rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-100">
          投稿指示リンクを読み取れません。リンクを発行し直してください。
        </p>
      ) : !directive ? (
        <p className="mt-3 rounded-lg border border-fuchsia-900 bg-zinc-950 p-4 text-sm leading-6 text-zinc-300">
          朝のレビューで発行された「投稿指示を開く」リンクからこの画面を開くと、仮説・根拠・投稿文・画像案・入口別リンク・判定日がここに表示されます。下のGrowth OS候補は参考データで、投稿指示ではありません。
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-fuchsia-900 bg-zinc-950 p-4">
              <p className="text-[11px] font-black text-fuchsia-200">実験 · {directive.date} · 判定 {directive.decisionDate}</p>
              <p className="mt-2 font-black text-white">{directive.experiment}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">仮説：{directive.hypothesis}</p>
              {directive.work && <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-cyan-200 hover:text-cyan-100" href={`/works/${directive.work.id}`} target="_blank" rel="noreferrer">作品 {directive.work.id} · {directive.work.title} <ExternalLink size={13} /></a>}
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-[11px] font-black text-zinc-300">選定根拠</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-zinc-400">
                {directive.evidence.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-fuchsia-900 bg-zinc-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-white">投稿本文（入口別リンクを付けてコピー）</p>
                <button type="button" onClick={() => void copy("post", directive.postText)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-fuchsia-600 px-3 text-xs font-black text-white hover:bg-fuchsia-500">
                  {copied === "post" ? <Check size={14} /> : <Copy size={14} />}{copied === "post" ? "本文コピー済み" : "本文だけコピー"}
                </button>
              </div>
              <textarea aria-label="投稿文" readOnly value={directive.postText} className="mt-3 min-h-40 w-full resize-y rounded-lg border border-zinc-800 bg-black p-3 text-sm leading-6 text-zinc-100" />
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-cyan-900 bg-zinc-950 p-4">
                <p className="text-sm font-black text-cyan-100">画像・動画案</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{directive.visualPlan}</p>
              </div>
              <div className="rounded-lg border border-emerald-900 bg-zinc-950 p-4">
                <p className="text-sm font-black text-emerald-100">投稿先と計測リンク</p>
                <div className="mt-2 space-y-2">
                  {directive.channels.map((channel) => (
                    <div key={`${channel.account}:${channel.postKey}`} className="rounded-lg border border-zinc-800 bg-black p-3">
                      <p className="text-xs font-black text-white">@{channel.account} · post_key {channel.postKey}</p>
                      <p className="mt-1 break-all text-[11px] leading-5 text-zinc-400">{channel.url}</p>
                      <button type="button" onClick={() => copyPostForChannel(channel)} className="mt-2 inline-flex h-8 items-center gap-2 rounded-lg border border-emerald-800 px-2.5 text-[11px] font-black text-emerald-100 hover:bg-emerald-950/40">
                        {copied === `post:${channel.account}` ? <Check size={13} /> : <Copy size={13} />}{copied === `post:${channel.account}` ? "投稿文をコピー済み" : "投稿文＋このリンクをコピー"}
                      </button>
                      <button type="button" disabled={Boolean(registering)} onClick={() => void registerTask(channel)} className="ml-2 mt-2 inline-flex h-8 items-center gap-2 rounded-lg bg-emerald-700 px-2.5 text-[11px] font-black text-white hover:bg-emerald-600 disabled:opacity-50">
                        {registering === `${channel.account}:${channel.postKey}` ? "登録中…" : "投稿後に計測タスクを登録"}
                      </button>
                      {registered[`${channel.account}:${channel.postKey}`] && <p role="status" className="mt-2 text-[11px] text-emerald-200">{registered[`${channel.account}:${channel.postKey}`]}</p>}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-5 text-zinc-400">投稿文＋リンクをコピー → Xに手動で公開 → 公開後すぐに「投稿後に計測タスクを登録」→ X投稿URLを登録、の順で使います。計測開始時刻を合わせるため、投稿前にはタスク登録しないでください。</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-900 bg-amber-950/20 p-4">
            <p className="text-sm leading-6 text-amber-100">判定指標：{directive.primaryMetric}<br />投稿後の表示数は各アカウントのX画面で24時間後に記録。投稿は内容を確認して人が公開します。</p>
            <a href="#x-daily-impression-tasks" className="rounded-lg border border-amber-800 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-950">投稿後の記録タスクへ</a>
          </div>
        </div>
      )}
    </section>
  );
}
