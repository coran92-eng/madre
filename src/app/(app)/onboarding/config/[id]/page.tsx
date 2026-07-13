import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { TemplateForm, AddItem, RemoveItem } from "../../OnboardingClient";

export const dynamic = "force-dynamic";

export default async function EditOnboardingPage({ params }: { params: { id: string } }) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const t = await prisma.onboardingTemplate.findUnique({ where: { id: params.id }, include: { items: { orderBy: { order: "asc" } } } });
  if (!t || !canAccessLocal(user, t.localId)) notFound();

  return (
    <>
      <PageHeader title={`Editar: ${t.name}`} action={<Link href="/onboarding/config" className="btn-secondary">Volver</Link>} />
      <div className="mb-4"><TemplateForm localId={t.localId} template={{ id: t.id, name: t.name }} /></div>
      <div className="card p-4">
        <h2 className="font-semibold mb-2">Tareas</h2>
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
    </>
  );
}
