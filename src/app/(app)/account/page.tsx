import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import AccountForm from "./AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={`${user.email} · ${ROLE_LABELS[user.role]}`} />
      <h2 className="font-semibold mb-3">Cambiar contraseña</h2>
      <AccountForm />
    </>
  );
}
