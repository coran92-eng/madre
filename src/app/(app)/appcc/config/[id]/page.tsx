import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { PointForm } from "../../AppccClient";

export const dynamic = "force-dynamic";

export default async function EditPointPage({ params }: { params: { id: string } }) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const p = await prisma.appccPoint.findUnique({ where: { id: params.id } });
  if (!p || !canAccessLocal(user, p.localId)) notFound();

  return (
    <>
      <PageHeader title={`Editar: ${p.name}`} action={<Link href="/appcc/config" className="btn-secondary">Volver</Link>} />
      <PointForm
        localId={p.localId}
        point={{ id: p.id, name: p.name, category: p.category, kind: p.kind, unit: p.unit, minValue: p.minValue, maxValue: p.maxValue, frequency: p.frequency, order: p.order }}
      />
    </>
  );
}
