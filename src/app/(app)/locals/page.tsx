import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CreateLocalForm, EditLocalRow } from "./LocalsClient";

export const dynamic = "force-dynamic";

export default async function LocalsPage() {
  await requireRole("SUPERADMIN");
  const locals = await prisma.local.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { employees: true } } },
  });

  return (
    <>
      <PageHeader title="Locales" subtitle="Multi-local: Corte de Manga, Sastrería BCN y Madrid" />
      <div className="mb-6"><CreateLocalForm /></div>
      <div className="card divide-y divide-stone-100">
        {locals.map((l) => (
          <EditLocalRow key={l.id} local={{ id: l.id, code: l.code, name: l.name, alertLeadDays: l.alertLeadDays, active: l.active }} />
        ))}
      </div>
      <p className="text-xs text-stone-400 mt-3">
        Los empleados, vacaciones, horarios y documentos se separan por local automáticamente.
        Usa el selector de la barra lateral para trabajar sobre un local concreto.
      </p>
    </>
  );
}
