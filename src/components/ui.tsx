import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {subtitle && <p className="text-stone-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const BADGE: Record<string, string> = {
  ACTIVO: "bg-green-100 text-green-800",
  BAJA: "bg-stone-200 text-stone-600",
  EXCEDENCIA: "bg-amber-100 text-amber-800",
  PENDIENTE: "bg-amber-100 text-amber-800",
  APROBADA: "bg-green-100 text-green-800",
  RECHAZADA: "bg-red-100 text-red-700",
  CANCELADA: "bg-stone-200 text-stone-600",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${BADGE[status] ?? "bg-stone-100 text-stone-700"}`}>{status}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-stone-400">{label}</div>
      <div className="text-2xl font-bold text-stone-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-stone-500 mt-1">{hint}</div>}
    </div>
  );
}

export function EmptyState({ children, cta }: { children: React.ReactNode; cta?: { href: string; label: string } }) {
  return (
    <div className="card p-8 text-center text-stone-500">
      <p>{children}</p>
      {cta && (
        <Link href={cta.href} className="btn-primary mt-4 inline-flex">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}
