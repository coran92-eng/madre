import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localScope } from "@/lib/rbac";
import { PageHeader, StatusBadge, EmptyState, fmtDate } from "@/components/ui";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { historico?: string };
}) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const showHistoric = searchParams.historico === "1";

  const employees = await prisma.employee.findMany({
    where: { ...localScope(user), deletedAt: showHistoric ? { not: null } : null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { local: true, user: { select: { id: true } } },
  });

  return (
    <>
      <PageHeader
        title="Empleados"
        subtitle={showHistoric ? "Histórico (bajas) — se conserva 4 años" : "Personal activo"}
        action={
          <Link href="/employees/new" className="btn-primary">
            + Nuevo empleado
          </Link>
        }
      />

      <div className="flex gap-2 mb-4 text-sm">
        <Link href="/employees" className={`px-3 py-1 rounded-full ${!showHistoric ? "bg-madre text-white" : "bg-stone-100 text-stone-600"}`}>
          Activos
        </Link>
        <Link href="/employees?historico=1" className={`px-3 py-1 rounded-full ${showHistoric ? "bg-madre text-white" : "bg-stone-100 text-stone-600"}`}>
          Histórico
        </Link>
      </div>

      {employees.length === 0 ? (
        <EmptyState cta={showHistoric ? undefined : { href: "/employees/new", label: "Dar de alta el primero" }}>
          {showHistoric ? "No hay empleados en el histórico." : "Todavía no hay empleados."}
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Contrato</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Alta</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2">
                    <Link href={`/employees/${e.id}`} className="font-medium text-madre hover:underline">
                      {e.lastName}, {e.firstName}
                    </Link>
                    <div className="text-xs text-stone-400">{e.local.code}{e.nif ? ` · ${e.nif}` : ""}</div>
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell text-stone-600">{e.contractType}</td>
                  <td className="px-4 py-2 hidden md:table-cell text-stone-600">{fmtDate(e.startDate)}</td>
                  <td className="px-4 py-2"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-2">
                    {e.user ? <span className="text-green-700 text-xs">✓ activo</span> : <span className="text-stone-400 text-xs">sin acceso</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
