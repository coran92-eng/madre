import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveLocalId } from "@/lib/localcontext";
import { PageHeader } from "@/components/ui";
import { TemplateForm, ToggleTemplate, AddItem, RemoveItem } from "../OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingConfigPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const localId = await getActiveLocalId(user);
  if (!localId) return <p>No hay local configurado.</p>;

  const templates = await prisma.onboardingTemplate.findMany({
    where: { localId },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    include: { items: { orderBy: { order: "asc" } } },
  });

  return (
    <>
      <PageHeader
        title="Configurar onboarding"
        action={<Link href="/onboarding" className="btn-secondary">Volver</Link>}
      />
      <div className="mb-6"><TemplateForm localId={localId} /></div>

      <div className="space-y-4">
        {templates.map((t) => (
          <div key={t.id} className={`card p-4 ${t.active ? "" : "opacity-60"}`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">{t.name}</h2>
              <div className="flex items-center gap-2">
                <Link href={`/onboarding/config/${t.id}`} className="text-madre hover:underline text-sm">Editar</Link>
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
