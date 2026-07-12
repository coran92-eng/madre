import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { getListScope } from "@/lib/localcontext";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { ProposeForm, CompanionButtons, ManagerButtons, CancelSwap } from "./SwapsClient";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  PROPUESTO: "Esperando al compañero",
  ACEPTADO_COMPANERO: "Esperando visto bueno",
  RECHAZADO_COMPANERO: "Rechazado por el compañero",
  APROBADO: "Aprobado",
  RECHAZADO_ENCARGADO: "Rechazado por el encargado",
  CANCELADO: "Cancelado",
};

function shiftLabel(s: { date: Date; startTime: string; endTime: string }) {
  return `${fmtDate(s.date)} · ${s.startTime}–${s.endTime}`;
}

export default async function SwapsPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const me = admin ? null : await prisma.employee.findUnique({ where: { userId: user.id } });

  // Resolve names for all employees in scope once.
  const scope = await getListScope(user);
  const emps = await prisma.employee.findMany({ where: { ...scope }, select: { id: true, firstName: true, lastName: true } });
  const name = new Map(emps.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  return (
    <>
      <PageHeader title="Cambios de turno" subtitle="Propuesta → aceptación del compañero → visto bueno del encargado" />
      {admin ? <ManagerView scope={scope} name={name} /> : <EmployeeView me={me} name={name} />}
    </>
  );
}

async function EmployeeView({ me, name }: { me: { id: string; localId: string } | null; name: Map<string, string> }) {
  if (!me) return <div className="card p-6 text-stone-600">Tu cuenta no está vinculada a una ficha de empleado.</div>;

  const today = new Date(new Date().toDateString());
  const [myShifts, colleagues, incoming, outgoing] = await Promise.all([
    prisma.shift.findMany({ where: { employeeId: me.id, published: true, date: { gte: today } }, orderBy: { date: "asc" } }),
    prisma.employee.findMany({ where: { localId: me.localId, deletedAt: null, status: "ACTIVO", id: { not: me.id } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    prisma.shiftSwap.findMany({ where: { targetEmployeeId: me.id, status: "PROPUESTO" }, include: { shift: true }, orderBy: { createdAt: "desc" } }),
    prisma.shiftSwap.findMany({ where: { requestedById: me.id, status: { notIn: ["CANCELADO"] } }, include: { shift: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <ProposeForm
        shifts={myShifts.map((s) => ({ id: s.id, label: shiftLabel(s) }))}
        colleagues={colleagues.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
      />

      <section>
        <h2 className="font-semibold mb-2">Propuestas que has recibido</h2>
        {incoming.length === 0 ? <EmptyState>Nada pendiente.</EmptyState> : (
          <div className="space-y-2">
            {incoming.map((s) => (
              <div key={s.id} className="card p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{name.get(s.requestedById) ?? "—"} te cede un turno</div>
                  <div className="text-xs text-stone-500">{shiftLabel(s.shift)}{s.note ? ` · ${s.note}` : ""}</div>
                </div>
                <CompanionButtons id={s.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Tus propuestas</h2>
        {outgoing.length === 0 ? <p className="text-sm text-stone-500">No has propuesto ningún cambio.</p> : (
          <div className="card divide-y divide-stone-100">
            {outgoing.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{shiftLabel(s.shift)}</span> → {name.get(s.targetEmployeeId) ?? "—"}
                  <div className="text-xs text-stone-500">{STATUS[s.status]}</div>
                </div>
                {["PROPUESTO", "ACEPTADO_COMPANERO"].includes(s.status) && <CancelSwap id={s.id} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function ManagerView({ scope, name }: { scope: { localId?: string }; name: Map<string, string> }) {
  const [pending, recent] = await Promise.all([
    prisma.shiftSwap.findMany({ where: { ...scope, status: "ACEPTADO_COMPANERO" }, include: { shift: true }, orderBy: { companionAt: "asc" } }),
    prisma.shiftSwap.findMany({ where: { ...scope, status: { in: ["APROBADO", "RECHAZADO_ENCARGADO", "RECHAZADO_COMPANERO"] } }, include: { shift: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold mb-2">Pendientes de visto bueno</h2>
        {pending.length === 0 ? <EmptyState>No hay cambios pendientes de aprobar.</EmptyState> : (
          <div className="space-y-2">
            {pending.map((s) => (
              <div key={s.id} className="card p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{name.get(s.requestedById) ?? "—"} → {name.get(s.targetEmployeeId) ?? "—"}</div>
                  <div className="text-xs text-stone-500">{shiftLabel(s.shift)} · el compañero aceptó</div>
                </div>
                <ManagerButtons id={s.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Historial reciente</h2>
        {recent.length === 0 ? <p className="text-sm text-stone-500">Sin registros.</p> : (
          <div className="card divide-y divide-stone-100">
            {recent.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                <span>{name.get(s.requestedById) ?? "—"} → {name.get(s.targetEmployeeId) ?? "—"} · {shiftLabel(s.shift)}</span>
                <span className="text-xs text-stone-500">{STATUS[s.status]}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
