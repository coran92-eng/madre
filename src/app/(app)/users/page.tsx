import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader, fmtDate } from "@/components/ui";
import { CreateUserForm, UserActions } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireRole("SUPERADMIN");
  const [users, locals] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }], include: { local: { select: { name: true } } } }),
    prisma.local.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Usuarios y accesos" subtitle="Gestión de cuentas: encargados, gestoría, superadmins" />

      <div className="mb-6">
        <CreateUserForm locals={locals.map((l) => ({ id: l.id, name: l.name }))} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Local</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Alta</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="px-4 py-2 font-medium">{u.email}{u.id === me.id && <span className="text-xs text-stone-400"> (tú)</span>}</td>
                <td className="px-4 py-2">{ROLE_LABELS[u.role]}</td>
                <td className="px-4 py-2 text-stone-600">{u.local?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  {u.active ? <span className="text-green-700 text-xs">activo</span> : <span className="text-stone-400 text-xs">inactivo</span>}
                </td>
                <td className="px-4 py-2 text-stone-400 text-xs">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-2">{u.id !== me.id && <UserActions id={u.id} active={u.active} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
