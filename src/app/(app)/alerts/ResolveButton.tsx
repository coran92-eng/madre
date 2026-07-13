"use client";

import { useTransition } from "react";
import { resolveExpiry } from "../employees/actions";

export default function ResolveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn-secondary text-xs px-2 py-1" disabled={pending} onClick={() => start(() => resolveExpiry(id))}>
      {pending ? "…" : "Resuelto"}
    </button>
  );
}
