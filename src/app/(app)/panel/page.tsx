import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { panelData } from "@/lib/analytics";
import { parseMonthKey, monthLabel, shiftMonthKey } from "@/lib/timeclock";
import { PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function PanelPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const { year, month } = parseMonthKey(searchParams.month);
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const { current: c, trend } = await panelData(user, year, month);

  const maxSales = Math.max(1, ...trend.map((t) => t.sales));
  const maxSph = Math.max(1, ...trend.map((t) => t.salesPerHour));

  return (
    <>
      <PageHeader
        title="Panel de dirección"
        subtitle={monthLabel(year, month)}
        action={
          <div className="flex gap-2">
            <Link href={`/panel?month=${shiftMonthKey(key, -1)}`} className="btn-secondary">←</Link>
            <Link href={`/panel?month=${shiftMonthKey(key, 1)}`} className="btn-secondary">→</Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Ventas del mes" value={eur(c.sales)} hint="neto de caja + tarjeta" />
        <Stat label="Ventas por hora" value={eur(c.salesPerHour)} hint="productividad" />
        <Stat label="Horas trabajadas" value={`${c.workedHours} h`} hint={`planificadas: ${c.plannedHours} h`} />
        <Stat label="Horas extra" value={`${c.overtimeHours} h`} hint="trabajadas − planificadas" />
        <Stat label="Propinas" value={eur(c.tips)} />
        <Stat label="Absentismo" value={`${c.absenceDays} d`} hint="días de ausencia aprobada" />
        <Stat label="Altas / bajas" value={`${c.hires} / ${c.terminations}`} hint="rotación del mes" />
        <Stat label="Empleados activos" value={c.activeEmployees} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Ventas · últimos 6 meses</h2>
          <TrendBars data={trend.map((t) => ({ label: `${MONTHS[t.month - 1]}`, value: t.sales, max: maxSales, text: eur(t.sales) }))} />
        </div>
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Ventas por hora · últimos 6 meses</h2>
          <TrendBars data={trend.map((t) => ({ label: `${MONTHS[t.month - 1]}`, value: t.salesPerHour, max: maxSph, text: eur(t.salesPerHour) }))} />
        </div>
      </div>

      <p className="text-xs text-stone-400 mt-4">
        El coste de personal en € requiere los salarios (hoy las nóminas son PDF). Como proxy estándar
        se usa la productividad (ventas por hora trabajada). Las ventas se estiman del cierre de caja.
      </p>
    </>
  );
}

function TrendBars({ data }: { data: { label: string; value: number; max: number; text: string }[] }) {
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <div className="text-[10px] text-stone-500 mb-1">{d.text}</div>
          <div className="w-full bg-madre/80 rounded-t" style={{ height: `${Math.max(2, (d.value / d.max) * 100)}%` }} title={d.text} />
          <div className="text-xs text-stone-400 mt-1">{d.label}</div>
        </div>
      ))}
    </div>
  );
}
