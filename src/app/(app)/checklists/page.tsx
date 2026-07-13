import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { getActiveLocalId } from "@/lib/localcontext";
import { PageHeader, EmptyState } from "@/components/ui";
import { CheckRow } from "./ChecklistsClient";

export const dynamic = "force-dynamic";

const MOMENT_LABEL: Record<string, string> = { APERTURA: "Apertura", CIERRE: "Cierre", OTRO: "Otras" };

function fmtTime(d: Date) {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export default async function ChecklistsPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const localId = user.role === "SUPERADMIN" ? await getActiveLocalId(user) : user.localId;
  if (!localId) return <p>No hay local configurado.</p>;

  const dayStart = new Date(new Date().toDateString());
  const templates = await prisma.checklistTemplate.findMany({
    where: { localId, active: true },
    orderBy: [{ moment: "asc" }, { order: "asc" }],
    include: {
      items: { orderBy: { order: "asc" } },
      runs: { where: { businessDate: dayStart }, include: { checks: true }, take: 1 },
    },
  });

  return (
    <>
      <PageHeader
        title="Checklists de turno"
        subtitle={`Apertura y cierre · ${new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}`}
        action={admin ? <Link href="/checklists/config" className="btn-primary">Configurar</Link> : null}
      />

      {templates.length === 0 ? (
        <EmptyState cta={admin ? { href: "/checklists/config", label: "Crear checklists" } : undefined}>
          No hay checklists configuradas.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => {
            const checks = new Map(t.runs[0]?.checks.map((c) => [c.itemId, c]) ?? []);
            const doneCount = t.items.filter((i) => checks.get(i.id)?.checked).length;
            return (
              <div key={t.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">
                    <span className="badge bg-stone-100 text-stone-600 mr-2">{MOMENT_LABEL[t.moment]}</span>
                    {t.name}
                  </h2>
                  <span className={`text-xs ${doneCount === t.items.length && t.items.length > 0 ? "text-green-700" : "text-stone-400"}`}>
                    {doneCount}/{t.items.length}
                  </span>
                </div>
                {t.items.length === 0 ? (
                  <p className="text-sm text-stone-400">Sin tareas.</p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {t.items.map((i) => {
                      const c = checks.get(i.id);
                      return (
                        <CheckRow
                          key={i.id}
                          itemId={i.id}
                          label={i.label}
                          checked={!!c?.checked}
                          byName={c?.byName}
                          at={c ? fmtTime(c.at) : null}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
