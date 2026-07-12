import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/ui";
import { ConfirmReadButton } from "./ManualClient";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const localId = user.localId ?? (await prisma.local.findFirst({ orderBy: { createdAt: "asc" } }))?.id ?? null;
  if (!localId) return <p>No hay locales configurados.</p>;

  const employee = admin ? null : await prisma.employee.findUnique({ where: { userId: user.id } });

  const sections = await prisma.manualSection.findMany({
    where: { localId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: employee
      ? { reads: { where: { employeeId: employee.id }, orderBy: { version: "desc" }, take: 1 } }
      : undefined,
  });

  return (
    <>
      <PageHeader
        title="Manual del bar"
        subtitle="Protocolos, carta y alérgenos, apertura/cierre, APPCC"
        action={admin ? <Link href="/manual/edit" className="btn-primary">Editar manual</Link> : null}
      />

      {sections.length === 0 ? (
        <EmptyState cta={admin ? { href: "/manual/edit", label: "Crear la primera sección" } : undefined}>
          El manual aún no tiene contenido.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => {
            const read = employee ? (s as typeof s & { reads: { version: number }[] }).reads[0] : null;
            const upToDate = read?.version === s.version;
            return (
              <article key={s.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold">{s.title}</h2>
                  {s.requiresReadConfirm && employee && (
                    <div className="shrink-0">
                      {upToDate ? (
                        <span className="text-green-700 text-xs">✓ Leído</span>
                      ) : read ? (
                        <div className="text-right">
                          <span className="text-amber-600 text-xs block mb-1">Actualizado</span>
                          <ConfirmReadButton sectionId={s.id} done={false} />
                        </div>
                      ) : (
                        <ConfirmReadButton sectionId={s.id} done={false} />
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-2 text-stone-700 whitespace-pre-wrap text-sm leading-relaxed">{s.content}</div>
                <div className="mt-2 text-xs text-stone-400">Versión {s.version}</div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
