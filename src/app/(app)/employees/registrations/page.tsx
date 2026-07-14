import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListScope, getActiveLocalId } from "@/lib/localcontext";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { InviteForm, RegistrationRow } from "./RegistrationsClient";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const scope = await getListScope(user);
  const fixedLocalId = user.role === "SUPERADMIN" ? undefined : (await getActiveLocalId(user)) ?? undefined;

  const [locals, toReview, invited, decided] = await Promise.all([
    prisma.local.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employeeRegistration.findMany({
      where: { ...scope, status: "PENDIENTE", submittedAt: { not: null } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.employeeRegistration.findMany({
      where: { ...scope, status: "PENDIENTE", submittedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employeeRegistration.findMany({
      where: { ...scope, status: { in: ["APROBADA", "RECHAZADA"] } },
      orderBy: { decidedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Solicitudes de alta"
        subtitle="Autorregistro de empleados: ellos rellenan sus datos, tú apruebas"
        action={<Link href="/employees" className="btn-secondary">Volver a empleados</Link>}
      />

      <div className="mb-8">
        <InviteForm locals={locals} fixedLocalId={fixedLocalId} />
      </div>

      <h2 className="font-semibold mb-2">Pendientes de revisión</h2>
      {toReview.length === 0 ? (
        <EmptyState>No hay solicitudes completadas esperando revisión.</EmptyState>
      ) : (
        <div className="space-y-3 mb-8">
          {toReview.map((r) => (
            <div key={r.id} className="card p-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{r.firstName} {r.lastName}</div>
                <div className="text-sm text-stone-600">{r.email} · {r.phone}</div>
                <div className="text-xs text-stone-400 mt-1">
                  {r.contractType} · {r.weeklyHours} h/sem · alta {r.startDate ? fmtDate(r.startDate) : "—"}
                  {r.nif && ` · NIF ${r.nif}`}
                </div>
                <div className="text-xs text-stone-400">Enviado {fmtDate(r.submittedAt!)}</div>
              </div>
              <RegistrationRow id={r.id} canDecide />
            </div>
          ))}
        </div>
      )}

      <h2 className="font-semibold mb-2">Invitaciones enviadas, esperando respuesta</h2>
      {invited.length === 0 ? (
        <EmptyState>No hay invitaciones pendientes.</EmptyState>
      ) : (
        <ul className="card divide-y divide-stone-100 mb-8 text-sm">
          {invited.map((r) => (
            <li key={r.id} className="px-4 py-2 flex items-center justify-between">
              <span>{r.email}</span>
              <span className="text-xs text-stone-400">
                enviada {fmtDate(r.createdAt)} · caduca {fmtDate(r.expiresAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="font-semibold mb-2">Historial reciente</h2>
          <ul className="card divide-y divide-stone-100 text-sm">
            {decided.map((r) => (
              <li key={r.id} className="px-4 py-2 flex items-center justify-between">
                <span>{r.firstName ? `${r.firstName} ${r.lastName}` : r.email}</span>
                <span className={`text-xs ${r.status === "APROBADA" ? "text-green-700" : "text-stone-400"}`}>
                  {r.status === "APROBADA" ? "Aprobada" : "Rechazada"} · {fmtDate(r.decidedAt!)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
