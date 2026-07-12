"use client";

import { useState, useTransition } from "react";
import { approveVacation, rejectVacation, decideAdjustment } from "../actions";

export function VacationDecision({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  function approve() {
    start(async () => {
      const res = await approveVacation(requestId);
      setError(res.error);
    });
  }
  function reject() {
    start(async () => {
      const res = await rejectVacation(requestId, note);
      setError(res.error);
      if (res.ok) setRejecting(false);
    });
  }

  return (
    <div className="text-right">
      {rejecting ? (
        <div className="flex flex-col items-end gap-1">
          <input
            className="input text-sm"
            placeholder="Motivo del rechazo"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="text-xs text-stone-500 hover:underline" onClick={() => setRejecting(false)}>Cancelar</button>
            <button className="btn-danger text-xs px-2 py-1" disabled={pending} onClick={reject}>Confirmar rechazo</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary text-xs px-2 py-1" disabled={pending} onClick={() => setRejecting(true)}>Rechazar</button>
          <button className="btn-primary text-xs px-2 py-1" disabled={pending} onClick={approve}>Aprobar</button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function AdjustmentDecision({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2 justify-end">
      <button className="btn-secondary text-xs px-2 py-1" disabled={pending} onClick={() => start(() => decideAdjustment(id, false))}>Rechazar</button>
      <button className="btn-primary text-xs px-2 py-1" disabled={pending} onClick={() => start(() => decideAdjustment(id, true))}>Aprobar</button>
    </div>
  );
}
