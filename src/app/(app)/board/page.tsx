import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { AnnouncementForm, MarkReadButton, DeleteAnnouncement } from "./BoardClient";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const employee = admin ? null : await prisma.employee.findUnique({ where: { userId: user.id } });

  // Visibility: global (localId null) + the viewer's local. Superadmin sees all.
  const where =
    user.role === "SUPERADMIN"
      ? {}
      : { OR: [{ localId: null }, { localId: user.localId ?? "__none__" }] };

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: employee
      ? { reads: { where: { employeeId: employee.id }, select: { id: true } }, _count: { select: { reads: true } } }
      : { _count: { select: { reads: true } } },
  });

  const locals = admin && user.role === "SUPERADMIN" ? await prisma.local.findMany({ orderBy: { name: "asc" } }) : [];

  return (
    <>
      <PageHeader title="Tablón de anuncios" subtitle="Comunicados oficiales (sustituye al WhatsApp para lo formal)" />

      {admin && (
        <div className="mb-6">
          <AnnouncementForm locals={locals.map((l) => ({ id: l.id, name: l.name }))} isSuper={user.role === "SUPERADMIN"} />
        </div>
      )}

      {announcements.length === 0 ? (
        <EmptyState>No hay comunicados.</EmptyState>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const read = employee ? (a as typeof a & { reads: { id: string }[] }).reads.length > 0 : false;
            return (
              <article key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{a.title}</h2>
                    <div className="text-xs text-stone-400">
                      {fmtDate(a.createdAt)} · {a.createdByEmail ?? "—"}
                      {a.localId === null && " · todos los locales"}
                      {a.requiresRead && ` · ${a._count.reads} lecturas`}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {a.requiresRead && employee && <MarkReadButton id={a.id} done={read} />}
                    {admin && <DeleteAnnouncement id={a.id} />}
                  </div>
                </div>
                <p className="mt-2 text-stone-700 whitespace-pre-wrap text-sm">{a.body}</p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
