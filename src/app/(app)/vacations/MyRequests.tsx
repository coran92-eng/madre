"use client";

import { useState, useTransition } from "react";
import { cancelVacation } from "./actions";

export function CancelButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("¿Cancelar esta solicitud de vacaciones? Las fechas quedarán libres para otros.")) return;
          start(async () => {
            const res = await cancelVacation(requestId);
            setError(res.error);
          });
        }}
      >
        {pending ? "…" : "Cancelar"}
      </button>
    </span>
  );
}
