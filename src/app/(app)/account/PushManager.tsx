"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "./actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function PushManager() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setEnabled(!!sub);
    }).catch(() => {});
  }, []);

  async function enable() {
    setBusy(true); setMsg(undefined);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setMsg("Permiso denegado en el navegador."); setBusy(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID!) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscription({ endpoint: json.endpoint, keys: json.keys });
      if (res.ok) { setEnabled(true); setMsg("Notificaciones activadas en este dispositivo."); }
    } catch (e) {
      setMsg("No se pudo activar. Requiere HTTPS y un navegador compatible.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true); setMsg(undefined);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setEnabled(false); setMsg("Notificaciones desactivadas en este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return <p className="text-sm text-stone-500">Este dispositivo/navegador no admite notificaciones push (o no están configuradas en el servidor).</p>;
  }

  return (
    <div className="flex items-center gap-3">
      {enabled ? (
        <button className="btn-secondary" disabled={busy} onClick={disable}>Desactivar en este dispositivo</button>
      ) : (
        <button className="btn-primary" disabled={busy} onClick={enable}>Activar notificaciones</button>
      )}
      {msg && <span className="text-sm text-stone-500">{msg}</span>}
    </div>
  );
}
