import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { getActiveLocalId } from "@/lib/localcontext";
import { PageHeader, EmptyState } from "@/components/ui";
import { RecordForm } from "./AppccClient";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = {
  TEMPERATURA: "Temperatura", RECEPCION: "Recepción", LIMPIEZA: "Limpieza",
  ACEITE: "Aceite freidora", TRAZABILIDAD: "Trazabilidad", OTRO: "Otro",
};

function fmtTime(d: Date) {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export default async function AppccPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const localId = user.role === "SUPERADMIN" ? await getActiveLocalId(user) : user.localId;
  if (!localId) return <p>No hay local configurado.</p>;

  const dayStart = new Date(new Date().toDateString());
  const points = await prisma.appccPoint.findMany({
    where: { localId, active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { records: { where: { recordedAt: { gte: dayStart } }, orderBy: { recordedAt: "desc" } } },
  });

  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        title="APPCC · Seguridad alimentaria"
        subtitle="Registros diarios de control (temperaturas, limpieza, recepción…)"
        action={
          <div className="flex gap-2">
            <a href={`/api/appcc/export?month=${month}`} className="btn-secondary">Exportar CSV</a>
            {admin && <Link href="/appcc/config" className="btn-primary">Configurar puntos</Link>}
          </div>
        }
      />

      {points.length === 0 ? (
        <EmptyState cta={admin ? { href: "/appcc/config", label: "Crear puntos de control" } : undefined}>
          No hay puntos de control configurados.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {points.map((p) => {
            const todays = p.records;
            const last = todays[0];
            const done = todays.length > 0;
            const anyFail = todays.some((r) => !r.ok);
            return (
              <div key={p.id} className={`card p-4 ${anyFail ? "border-red-300 bg-red-50" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-stone-400">
                      {CAT_LABEL[p.category]}
                      {p.kind === "NUMERIC" && (p.minValue != null || p.maxValue != null) && ` · rango ${p.minValue ?? "—"}…${p.maxValue ?? "—"}${p.unit ?? ""}`}
                      {" · "}{p.frequency.toLowerCase()}
                    </div>
                  </div>
                  <RecordForm point={{ id: p.id, kind: p.kind, unit: p.unit }} />
                </div>
                <div className="mt-2 text-xs">
                  {!done ? (
                    <span className="text-amber-600">Pendiente de registrar hoy</span>
                  ) : (
                    <span className={anyFail ? "text-red-700" : "text-green-700"}>
                      {todays.length} registro(s) hoy · último {fmtTime(last.recordedAt)} por {last.recordedByName}
                      {last.numValue != null && ` · ${last.numValue}${p.unit ?? ""}`}
                      {last.boolValue != null && ` · ${last.boolValue ? "hecho" : "no hecho"}`}
                      {last.textValue && ` · ${last.textValue}`}
                      {anyFail && " · ⚠ hubo un valor fuera de umbral"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
