import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SectionForm } from "../ManualClient";

export const dynamic = "force-dynamic";

export default async function ManualEditPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const localId = user.localId ?? (await prisma.local.findFirst({ orderBy: { createdAt: "asc" } }))?.id ?? null;
  if (!localId) return <p>No hay locales configurados.</p>;

  const sections = await prisma.manualSection.findMany({
    where: { localId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { reads: true } } },
  });

  return (
    <>
      <PageHeader
        title="Editar manual"
        action={<Link href="/manual" className="btn-secondary">Ver manual</Link>}
      />

      <div className="mb-8">
        <h2 className="font-semibold mb-3">Nueva sección</h2>
        <SectionForm localId={localId} />
      </div>

      <h2 className="font-semibold mb-3">Secciones existentes</h2>
      {sections.length === 0 ? (
        <p className="text-sm text-stone-500">Todavía no hay secciones.</p>
      ) : (
        <div className="card divide-y divide-stone-100">
          {sections.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between">
              <div>
                <span className="font-medium">{s.title}</span>
                <span className="text-xs text-stone-400 ml-2">v{s.version} · {s._count.reads} lecturas · orden {s.order}</span>
              </div>
              <Link href={`/manual/edit/${s.id}`} className="text-madre hover:underline text-sm">Editar</Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
