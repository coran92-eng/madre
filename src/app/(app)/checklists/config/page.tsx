import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveLocalId } from "@/lib/localcontext";
import { PageHeader } from "@/components/ui";
import { TemplateForm, ToggleTemplate, AddItem, RemoveItem } from "../ChecklistsClient";

export const dynamic = "force-dynamic";

const MOMENT_LABEL: Record<string, string> = { APERTURA: "Apertura", CIERRE: "Cierre", OTRO: "Otras" };

export default async function ChecklistConfigPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const localId = await getActiveLocalId(user);
  if (!localId) return <p>No hay local configurado.</p>;

  const templates = await prisma.checklistTemplate.findMany({
    where: { localId },
    orderBy: [{ active: "desc" }, { moment: "asc" }, { order: "asc" }],
    include: { items: { orderBy: { order: "asc" } } },
  });

  return (
    <>
      <PageHeader
        title="Configurar checklists"
        action={<Link href="/checklists" className="btn-secondary">Volver</Link>}
      />
      <div className="mb-6"><TemplateForm localId={localId} /></div>

      <div className="space-y-4">
        {templates.map((t) => (
          <div key={t.id} className={`card p-4 ${t.active ? "" : "opacity-60"}`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">
                <span className="badge bg-stone-100 text-stone-600 mr-2">{MOMENT_LABEL[t.moment]}</span>
                {t.name}
              </h2>
              <div className="flex items-center gap-2">
                <Link href={`/checklists/config/${t.id}`} className="text-madre hover:underline text-sm">Editar</Link>
                <ToggleTemplate id={t.id} active={t.active} />
              </div>
            </div>
            <ul className="divide-y divide-stone-100">
              {t.items.map((i) => (
                <li key={i.id} className="py-1.5 flex items-center justify-between text-sm">
                  <span>{i.label}</span>
                  <RemoveItem id={i.id} />
                </li>
              ))}
            </ul>
            <AddItem templateId={t.id} />
          </div>
        ))}
      </div>
    </>
  );
}
