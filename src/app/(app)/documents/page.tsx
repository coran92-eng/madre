import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, localScope } from "@/lib/rbac";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { UploadForm, AckButton } from "./DocumentsClient";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  NOMINA: "Nómina",
  CONTRATO: "Contrato",
  ANEXO: "Anexo",
  AMONESTACION: "Amonestación",
  COMUNICACION: "Comunicación",
  OTRO: "Otro",
};

export default async function DocumentsPage() {
  const user = await requireUser();
  const admin = isAdmin(user) || user.role === "GESTORIA";

  if (admin) return <AdminDocs user={user} />;
  return <EmployeeDocs userId={user.id} />;
}

async function AdminDocs({ user }: { user: Awaited<ReturnType<typeof requireUser>> }) {
  const [documents, employees] = await Promise.all([
    prisma.document.findMany({
      where: { ...localScope(user) },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        acks: { select: { ackedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.employee.findMany({
      where: { ...localScope(user), deletedAt: null },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="Documentos" subtitle="Nóminas, contratos y comunicaciones" />
      {employees.length > 0 && (
        <div className="mb-6">
          <UploadForm employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))} />
        </div>
      )}
      {documents.length === 0 ? (
        <EmptyState>Todavía no hay documentos.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Documento</th>
                <th className="px-4 py-2 font-medium">Empleado</th>
                <th className="px-4 py-2 font-medium">Subido</th>
                <th className="px-4 py-2 font-medium">Recepción</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {documents.map((d) => (
                <tr key={d.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{d.title}</div>
                    <div className="text-xs text-stone-400">{TYPE_LABELS[d.type]}{d.period ? ` · ${d.period}` : ""}</div>
                  </td>
                  <td className="px-4 py-2 text-stone-600">{d.employee.lastName}, {d.employee.firstName}</td>
                  <td className="px-4 py-2 text-stone-600">{fmtDate(d.createdAt)}</td>
                  <td className="px-4 py-2">
                    {!d.requiresAck ? (
                      <span className="text-stone-400 text-xs">no requiere</span>
                    ) : d.acks.length > 0 ? (
                      <span className="text-green-700 text-xs">✓ {fmtDate(d.acks[0].ackedAt)}</span>
                    ) : (
                      <span className="text-amber-600 text-xs">pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/api/documents/${d.id}/download`} target="_blank" className="text-madre hover:underline text-xs">Ver</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function EmployeeDocs({ userId }: { userId: string }) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) {
    return (
      <>
        <PageHeader title="Documentos" />
        <div className="card p-6 text-stone-600">Tu cuenta no está vinculada a una ficha de empleado.</div>
      </>
    );
  }
  const documents = await prisma.document.findMany({
    where: { employeeId: employee.id },
    include: { acks: { where: { employeeId: employee.id }, select: { ackedAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Mis documentos" subtitle="Nóminas, contratos y comunicaciones" />
      {documents.length === 0 ? (
        <EmptyState>No tienes documentos todavía.</EmptyState>
      ) : (
        <div className="space-y-3">
          {documents.map((d) => {
            const acked = d.acks.length > 0;
            return (
              <div key={d.id} className="card p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-stone-400">{TYPE_LABELS[d.type]}{d.period ? ` · ${d.period}` : ""} · {fmtDate(d.createdAt)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/api/documents/${d.id}/download`} target="_blank" className="text-madre hover:underline text-sm">Ver</a>
                  {d.requiresAck && (acked ? (
                    <span className="text-green-700 text-xs">✓ Recibido {fmtDate(d.acks[0].ackedAt)}</span>
                  ) : (
                    <AckButton documentId={d.id} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
