"use client";

import { Bell, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useIPhoneInstallGuide } from "@/components/useIPhoneInstallGuide";

type Props = { contentId: string; workTitle: string; makers: string[] };

export default function FanzaAmateurPriceAlertButton({ contentId, workTitle, makers }: Props) {
  const [open, setOpen] = useState(false);
  const showIPhoneGuide = useIPhoneInstallGuide();
  const [priceAlert, setPriceAlert] = useState(false);
  const [selectedMakers, setSelectedMakers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const enableNotifications = async () => {
    setMessage(null);
    setSaving(true);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("このブラウザはプッシュ通知に対応していません。");
      if (!window.isSecureContext) throw new Error("通知にはHTTPS、またはlocalhostでのアクセスが必要です。");

      const configResponse = await fetch("/api/push/subscribe");
      const config = (await configResponse.json()) as { publicKey?: string; error?: string };
      if (!configResponse.ok || !config.publicKey) throw new Error(config.error ?? "通知設定がまだ準備されていません。");

      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") throw new Error("ブラウザの通知許可が必要です。");

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0)),
      });

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      let response: Response;
      try {
        response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON(), mediaType: "amateur", contentId, priceAlert, makerAlerts: selectedMakers }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "通知設定を保存できませんでした。");
      setMessage("通知を有効にしました。");
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError" ? "通知設定の保存がタイムアウトしました。時間をおいて再度お試しください。" : error instanceof Error ? error.message : "通知設定に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const selectAllMakers = () => setSelectedMakers(selectedMakers.length === makers.length ? [] : makers);

  return <div className="mt-6">
    <button type="button" aria-expanded={open} aria-controls={`amateur-price-alert-${contentId}`} onClick={() => setOpen((current) => !current)} className="flex h-16 w-full items-center gap-3 rounded-full border border-pink-200 bg-pink-50 px-4 text-left text-sm font-black text-slate-700 transition hover:border-pink-300 hover:bg-pink-100">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden="true"><Bell size={16} /></span>
      <span className="min-w-0 flex-1"><span className="block">プッシュ通知</span><span className="mt-0.5 block text-[11px] font-medium text-slate-500">値下げ・メーカー新作を選んで通知を受け取る</span></span>
      <ChevronDown size={17} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {open && <div id={`amateur-price-alert-${contentId}`} className="rounded-b-2xl border border-t-0 border-pink-200 bg-white px-4 py-4 text-xs leading-5 text-slate-600">
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between font-black text-slate-700"><span>⏱ 値下げ通知（チェックした作品が値下がりしたら）</span><button type="button" className="text-slate-500 hover:text-pink-600" onClick={() => setPriceAlert((current) => !current)}>{priceAlert ? "解除" : "全選択"}</button></div>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={priceAlert} onChange={(event) => setPriceAlert(event.target.checked)} className="h-4 w-4 accent-pink-600" />{workTitle}</label>
        </div>
        {makers.length > 0 && <div>
          <div className="mb-1 flex items-center justify-between font-black text-slate-700"><span>▣ 新作通知 — メーカー</span><button type="button" className="text-slate-500 hover:text-pink-600" onClick={selectAllMakers}>{selectedMakers.length === makers.length ? "解除" : "全選択"}</button></div>
          {makers.map((maker) => <label key={maker} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={selectedMakers.includes(maker)} onChange={() => setSelectedMakers((current) => current.includes(maker) ? current.filter((name) => name !== maker) : [...current, maker])} className="h-4 w-4 accent-pink-600" />{maker}</label>)}
        </div>}
        <p className="text-slate-500">※ 選んだ通知だけが届きます。女優の新作通知はありません。</p>
        {showIPhoneGuide && <p className="rounded-lg bg-pink-50 px-3 py-2 text-slate-600">iPhoneでは、共有ボタンから「ホーム画面に追加」すると通知を受け取れます。</p>}
        {message && <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{message}</p>}
        <div className="flex items-center justify-end gap-4 pt-1"><button type="button" className="font-bold text-slate-500 hover:text-slate-700" onClick={() => setOpen(false)}>キャンセル</button><button type="button" disabled={saving} onClick={() => void enableNotifications()} className="rounded-full bg-pink-600 px-5 py-2.5 font-black text-white hover:bg-pink-700 disabled:cursor-wait disabled:opacity-60">{saving ? "設定中…" : "通知を有効にする"}</button></div>
      </div>
    </div>}
  </div>;
}
