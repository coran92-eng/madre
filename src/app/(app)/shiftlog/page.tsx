import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { getActiveLocalId } from "@/lib/localcontext";
import { PageHeader, EmptyState } from "@/components/ui";
import { PostForm, ReadButton, DeleteLog } from "./ShiftLogClient";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date) {
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export default async function ShiftLogPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const localId = user.role === "SUPERADMIN" ? await getActiveLocalId(user) : user.localId;
  if (!localId) return <p>No hay local configurado.</p>;

  const employee = admin ? null : await prisma.employee.findUnique({ where: { userId: user.id } });

  const logs = await prisma.shiftLog.findMany({
    where: { localId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: employee
      ? { reads: { where: { employeeId: employee.id }, select: { id: true } }, _count: { select: { reads: true } } }
      : { _count: { select: { reads: true } } },
  });

  return (
    <>
      <PageHeader title="Parte de turno" subtitle="Notas de relevo entre turnos, con autor y hora" />
      <div className="mb-6"><PostForm /></div>

      {logs.length === 0 ? (
        <EmptyState>No hay partes todavía.</EmptyState>
      ) : (
        <div className="space-y-3">
          {logs.map((l) => {
            const read = employee ? (l as typeof l & { reads: { id: string }[] }).reads.length > 0 : false;
            return (
              <article key={l.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium">{l.authorName ?? "—"}</span>
                    {l.shift && <span className="badge bg-stone-100 text-stone-600 ml-2">{l.shift}</span>}
                    <div className="text-xs text-stone-400">{fmtDateTime(l.createdAt)} · {l._count.reads} lectura(s)</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {employee && <ReadButton logId={l.id} done={read} />}
                    {(admin || l.authorId === user.id) && <DeleteLog id={l.id} />}
                  </div>
                </div>
                <p className="mt-2 text-stone-700 whitespace-pre-wrap text-sm">{l.body}</p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
