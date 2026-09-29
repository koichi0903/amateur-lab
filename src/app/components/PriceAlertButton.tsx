"use client";

import { Bell, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  workId: number;
  workTitle: string;
  actress: string | null;
  maker: string | null;
};

function splitNames(value: string | null) {
  return [...new Set((value ?? "").split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).map((name) => name.trim()).filter(Boolean))];
}

export default function PriceAlertButton({ workId, workTitle, actress, maker }: Props) {
  const [open, setOpen] = useState(false);
  const [showIPhoneGuide, setShowIPhoneGuide] = useState(false);
  const [priceAlert, setPriceAlert] = useState(false);
  const [selectedActresses, setSelectedActresses] = useState<string[]>([]);
  const [selectedMakers, setSelectedMakers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const actresses = splitNames(actress);
  const makers = splitNames(maker);

  const toggleName = (names: string[], setNames: (value: string[]) => void, name: string) => {
    setNames(names.includes(name) ? names.filter((current) => current !== name) : [...names, name]);
  };

  useEffect(() => {
    const isIPhone = /iPhone/i.test(window.navigator.userAgent);
    const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    setShowIPhoneGuide(isIPhone && !isStandalone);
  }, []);

  const enableNotifications = async () => {
    setMessage(null);
    setSaving(true);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("このブラウザはプッシュ通知に対応していません。");
      }
      if (!window.isSecureContext) {
        throw new Error("通知にはHTTPS、またはlocalhostでのアクセスが必要です。");
      }

      const configResponse = await fetch("/api/push/subscribe");
      const config = (await configResponse.json()) as { publicKey?: string; error?: string };
      if (!configResponse.ok || !config.publicKey) throw new Error(config.error ?? "通知設定がまだ準備されていません。");

      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") throw new Error("ブラウザの通知許可が必要です。");

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0)),
      });

      const saveController = new AbortController();
      const saveTimeout = window.setTimeout(() => saveController.abort(), 15_000);
      let saveResponse: Response;
      try {
        saveResponse = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            workId,
          priceAlert,
          actressAlerts: selectedActresses,
          makerAlerts: selectedMakers,
          }),
          signal: saveController.signal,
        });
      } finally {
        window.clearTimeout(saveTimeout);
      }
      const result = (await saveResponse.json()) as { error?: string };
      if (!saveResponse.ok) throw new Error(result.error ?? "通知設定を保存できませんでした。");
      setMessage("通知を有効にしました。");
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError" ? "通知設定の保存がタイムアウトしました。時間をおいて再度お試しください。" : error instanceof Error ? error.message : "通知設定に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`price-alert-${workId}`}
        onClick={() => setOpen((current) => !current)}
        className="flex h-16 w-full items-center gap-3 rounded-full border border-pink-200 bg-pink-50 px-4 text-left text-sm font-black text-slate-700 transition hover:border-pink-300 hover:bg-pink-100"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden="true">
          <Bell size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block">プッシュ通知</span>
          <span className="mt-0.5 block text-[11px] font-medium text-slate-500">値下げ・新作を個別に選んで通知を受け取る</span>
        </span>
        <ChevronDown size={17} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={`price-alert-${workId}`} className="rounded-b-2xl border border-t-0 border-pink-200 bg-white px-4 py-4 text-xs leading-5 text-slate-600">
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between font-black text-slate-700"><span>⏱ 値下げ通知（チェックした作品が値下がりしたら）</span><button type="button" className="text-slate-500 hover:text-pink-600" onClick={() => setPriceAlert(true)}>全選択</button></div>
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={priceAlert} onChange={(event) => setPriceAlert(event.target.checked)} className="h-4 w-4 accent-pink-600" />{workTitle}</label>
            </div>
            {actresses.length > 0 && <div>
              <div className="mb-1 flex items-center justify-between font-black text-slate-700"><span>▣ 新作通知 — 女優</span><button type="button" className="text-slate-500 hover:text-pink-600" onClick={() => setSelectedActresses(actresses)}>全選択</button></div>
              {actresses.map((name) => <label key={name} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={selectedActresses.includes(name)} onChange={() => toggleName(selectedActresses, setSelectedActresses, name)} className="h-4 w-4 accent-pink-600" />{name}</label>)}
            </div>}
            {makers.length > 0 && <div>
              <div className="mb-1 flex items-center justify-between font-black text-slate-700"><span>▣ 新作通知 — メーカー</span><button type="button" className="text-slate-500 hover:text-pink-600" onClick={() => setSelectedMakers(makers)}>全選択</button></div>
              {makers.map((name) => <label key={name} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={selectedMakers.includes(name)} onChange={() => toggleName(selectedMakers, setSelectedMakers, name)} className="h-4 w-4 accent-pink-600" />{name}</label>)}
            </div>}
            <p className="text-slate-500">※ 何も選ばなければその種類の通知は届きません</p>
            {showIPhoneGuide && <p className="rounded-lg bg-pink-50 px-3 py-2 text-slate-600">iPhoneでは、共有ボタンから「ホーム画面に追加」すると通知を受け取れます。</p>}
            {message && <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{message}</p>}
            <div className="flex items-center justify-end gap-4 pt-1"><button type="button" className="font-bold text-slate-500 hover:text-slate-700" onClick={() => setOpen(false)}>キャンセル</button><button type="button" disabled={saving} onClick={() => void enableNotifications()} className="rounded-lg bg-pink-600 px-4 py-2 font-black text-white hover:bg-pink-700 disabled:cursor-wait disabled:opacity-60">{saving ? "設定中…" : "通知を有効にする"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
