import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Madrid" });
}

export default async function AuditPage({ searchParams }: { searchParams: { page?: string } }) {
  await requireRole("SUPERADMIN");
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count(),
  ]);
  const pages = Math.ceil(total / pageSize);

  return (
    <>
      <PageHeader title="Registro de actividad" subtitle={`${total} eventos · log inmutable`} />
      {logs.length === 0 ? (
        <EmptyState>Sin actividad registrada.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Acción</th>
                <th className="px-4 py-2 font-medium">Entidad</th>
                <th className="px-4 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 text-stone-500 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-4 py-2 text-stone-600">{l.actorEmail ?? "—"}</td>
                  <td className="px-4 py-2"><code className="text-xs bg-stone-100 rounded px-1.5 py-0.5">{l.action}</code></td>
                  <td className="px-4 py-2 text-stone-500">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}</td>
                  <td className="px-4 py-2 text-stone-400 text-xs">{l.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex gap-2 mt-4 text-sm">
          {page > 1 && <a href={`/audit?page=${page - 1}`} className="btn-secondary">← Anterior</a>}
          <span className="px-3 py-2 text-stone-500">Página {page} de {pages}</span>
          {page < pages && <a href={`/audit?page=${page + 1}`} className="btn-secondary">Siguiente →</a>}
        </div>
      )}
    </>
  );
}
