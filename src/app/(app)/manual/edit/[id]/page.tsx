import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { SectionForm, DeleteSection } from "../../ManualClient";

export const dynamic = "force-dynamic";

export default async function EditSectionPage({ params }: { params: { id: string } }) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const s = await prisma.manualSection.findUnique({ where: { id: params.id } });
  if (!s || !canAccessLocal(user, s.localId)) notFound();

  return (
    <>
      <PageHeader
        title={`Editar: ${s.title}`}
        subtitle={`Versión ${s.version}`}
        action={<Link href="/manual/edit" className="btn-secondary">Volver</Link>}
      />
      <SectionForm localId={s.localId} section={{ id: s.id, title: s.title, content: s.content, order: s.order, requiresReadConfirm: s.requiresReadConfirm }} />
      <div className="card p-4 mt-6 flex items-center justify-between">
        <div>
          <p className="font-medium">Eliminar sección</p>
          <p className="text-sm text-stone-500">Se borra la sección y su registro de lecturas.</p>
        </div>
        <DeleteSection id={s.id} />
      </div>
    </>
  );
}
