"use client";

import { useTransition } from "react";
import { cancelVacation } from "./actions";

export function CancelButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={() => start(() => cancelVacation(requestId))}
    >
      {pending ? "…" : "Cancelar"}
    </button>
  );
}
