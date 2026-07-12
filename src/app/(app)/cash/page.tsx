import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localScope } from "@/lib/rbac";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import CashForm from "./CashForm";

export const dynamic = "force-dynamic";

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export default async function CashPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const locals = await prisma.local.findMany({ orderBy: { name: "asc" } });

  const closes = await prisma.cashClose.findMany({
    where: { ...localScope(user) },
    orderBy: { businessDate: "desc" },
    take: 60,
  });

  return (
    <>
      <PageHeader title="Cierre de caja" subtitle="Registro y consulta de cierres diarios" />

      <div className="mb-6">
        <CashForm
          locals={locals.map((l) => ({ id: l.id, name: l.name }))}
          fixedLocalId={user.role === "SUPERADMIN" ? undefined : user.localId ?? undefined}
        />
      </div>

      {closes.length === 0 ? (
        <EmptyState>No hay cierres registrados.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Efectivo</th>
                <th className="px-4 py-2 font-medium">Tarjeta</th>
                <th className="px-4 py-2 font-medium">Otros</th>
                <th className="px-4 py-2 font-medium">Descuadre</th>
                <th className="px-4 py-2 font-medium">Registró</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {closes.map((c) => {
                const diff = c.expectedCash != null ? c.cashCounted - c.expectedCash : null;
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2">{fmtDate(c.businessDate)}</td>
                    <td className="px-4 py-2">{eur(c.cashCounted)}</td>
                    <td className="px-4 py-2 text-stone-600">{eur(c.cardTotal)}</td>
                    <td className="px-4 py-2 text-stone-600">{eur(c.otherTotal)}</td>
                    <td className="px-4 py-2">
                      {diff == null ? <span className="text-stone-400">—</span> : (
                        <span className={Math.abs(diff) < 0.01 ? "text-green-700" : "text-red-600"}>{eur(diff)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-stone-400 text-xs">{c.createdByEmail ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
