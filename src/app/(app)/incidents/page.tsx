import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListScope } from "@/lib/localcontext";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { IncidentForm, DeleteIncident } from "./IncidentsClient";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");

  const [incidents, employees] = await Promise.all([
    prisma.incident.findMany({
      where: { ...(await getListScope(user)) },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.employee.findMany({
      where: { ...(await getListScope(user)), deletedAt: null },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="Registro de incidencias" subtitle="Anotaciones de rendimiento y disciplina · solo admin" />

      {employees.length > 0 && (
        <div className="mb-6">
          <IncidentForm employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))} />
        </div>
      )}

      {incidents.length === 0 ? (
        <EmptyState>No hay incidencias registradas.</EmptyState>
      ) : (
        <div className="space-y-3">
          {incidents.map((i) => (
            <div key={i.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{i.employee.lastName}, {i.employee.firstName}</div>
                  <div className="text-xs text-stone-400">{fmtDate(i.date)}{i.category ? ` · ${i.category}` : ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  {i.storageKey && <a href={`/api/incidents/${i.id}/file`} target="_blank" className="text-madre hover:underline text-xs">Adjunto</a>}
                  <DeleteIncident id={i.id} />
                </div>
              </div>
              <p className="mt-2 text-sm text-stone-700 whitespace-pre-wrap">{i.description}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
