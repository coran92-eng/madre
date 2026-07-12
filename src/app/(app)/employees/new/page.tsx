import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localScope } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import EmployeeForm from "../EmployeeForm";
import { createEmployee } from "../actions";

export default async function NewEmployeePage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const locals = await prisma.local.findMany({
    where: user.role === "SUPERADMIN" ? {} : { id: user.localId ?? "__none__" },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Nuevo empleado"
        action={<Link href="/employees" className="btn-secondary">Cancelar</Link>}
      />
      <EmployeeForm
        action={createEmployee}
        locals={locals}
        fixedLocalId={user.role === "SUPERADMIN" ? undefined : user.localId ?? undefined}
        submitLabel="Crear empleado"
      />
    </>
  );
}
