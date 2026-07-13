"use client";

import { useState, useTransition } from "react";
import { startTotpSetup, confirmTotpSetup, disableTotp } from "./twofactor-actions";

type SetupState = {
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
};

export default function TwoFactorManager({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [token, setToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string>();
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [pending, start] = useTransition();

  function beginSetup() {
    setError(undefined);
    start(async () => {
      const res = await startTotpSetup();
      setSetup(res);
    });
  }

  function confirm() {
    setError(undefined);
    start(async () => {
      const res = await confirmTotpSetup(token);
      if (!res.ok) {
        setError(res.error ?? "No se pudo verificar el código.");
        return;
      }
      setBackupCodes(res.backupCodes ?? []);
      setEnabled(true);
      setSetup(null);
      setToken("");
    });
  }

  function finish() {
    setBackupCodes(null);
  }

  function disable() {
    start(async () => {
      await disableTotp();
      setEnabled(false);
      setConfirmDisable(false);
    });
  }

  if (backupCodes) {
    return (
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-red-700">
          Guarda estos códigos de respaldo en un lugar seguro. No se volverán a mostrar.
        </p>
        <p className="text-sm text-stone-500">
          Cada código solo se puede usar una vez, si pierdes el acceso a tu app autenticadora.
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
          {backupCodes.map((c) => (
            <li key={c} className="bg-stone-50 rounded-md px-2 py-1 text-center">{c}</li>
          ))}
        </ul>
        <button className="btn-primary" onClick={finish}>Ya los he guardado</button>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="card p-4 space-y-3">
        <p className="text-sm text-green-700">Verificación en dos pasos activa.</p>
        {!confirmDisable ? (
          <button className="btn-secondary" onClick={() => setConfirmDisable(true)}>Desactivar</button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-700">¿Seguro? Tendrás que activarla de nuevo si quieres volver a usarla.</span>
            <button className="text-xs text-stone-500" onClick={() => setConfirmDisable(false)}>Cancelar</button>
            <button className="btn-danger text-xs px-2 py-1" disabled={pending} onClick={disable}>
              {pending ? "Desactivando…" : "Sí, desactivar"}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (setup) {
    return (
      <div className="card p-4 space-y-3">
        <p className="text-sm text-stone-500">
          Escanea este código QR con tu app autenticadora (Google Authenticator, Authy…) o introduce la clave manualmente.
        </p>
        <img src={setup.qrDataUrl} alt="Código QR para configurar 2FA" className="w-40 h-40" />
        <p className="text-xs font-mono bg-stone-50 rounded-md p-2 break-all">{setup.secret}</p>
        <div>
          <label className="label" htmlFor="totp-token">Código de confirmación (6 dígitos)</label>
          <input
            id="totp-token"
            className="input"
            inputMode="numeric"
            maxLength={6}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{error}</p>}
        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={pending || token.length === 0} onClick={confirm}>
            {pending ? "Verificando…" : "Confirmar y activar"}
          </button>
          <button className="text-sm text-stone-500" onClick={() => setSetup(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm text-stone-500">
        Añade una capa extra de seguridad a tu cuenta pidiendo un código de tu app autenticadora al iniciar sesión.
      </p>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{error}</p>}
      <button className="btn-primary" disabled={pending} onClick={beginSetup}>
        {pending ? "Preparando…" : "Activar verificación en dos pasos"}
      </button>
    </div>
  );
}
