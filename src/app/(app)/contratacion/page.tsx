import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListScope } from "@/lib/localcontext";
import { currentMonthKey } from "@/lib/timeclock";
import { PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

// Área de gestoría (spec §3/§7): descargar datos de contratación y registro horario.
export default async function ContratacionPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO", "GESTORIA");
  const scope = await getListScope(user);
  const month = currentMonthKey();

  const [active, historic, payslips] = await Promise.all([
    prisma.employee.count({ where: { ...scope, deletedAt: null } }),
    prisma.employee.count({ where: { ...scope, deletedAt: { not: null } } }),
    prisma.document.count({ where: { ...scope, type: "NOMINA" } }),
  ]);

  return (
    <>
      <PageHeader title="Contratación y gestoría" subtitle="Descargas para la gestoría y datos de contratación" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Empleados activos" value={active} />
        <Stat label="En histórico" value={historic} />
        <Stat label="Nóminas subidas" value={payslips} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-semibold">Datos de contratación</h2>
          <p className="text-sm text-stone-500 mt-1 mb-3">
            NIF, nº SS, IBAN, tipo de contrato, jornada y fechas — en CSV.
          </p>
          <div className="flex gap-2">
            <a href="/api/employees/export" className="btn-primary">Descargar activos</a>
            <a href="/api/employees/export?historico=1" className="btn-secondary">Incluir histórico</a>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold">Registro horario</h2>
          <p className="text-sm text-stone-500 mt-1 mb-3">
            Fichajes del mes en CSV (Inspección de Trabajo).
          </p>
          <a href={`/api/timeclock/export?month=${month}`} className="btn-primary">Descargar {month}</a>
        </div>
      </div>

      <p className="text-xs text-stone-400 mt-4">
        La subida de nóminas se hace desde <a href="/documents" className="underline">Documentos</a>{" "}
        (individual o por lote con asignación por NIF).
      </p>
    </>
  );
}
