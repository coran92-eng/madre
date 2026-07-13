import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import AccountForm from "./AccountForm";
import PushManager from "./PushManager";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={`${user.email} · ${ROLE_LABELS[user.role]}`} />

      <h2 className="font-semibold mb-3">Cambiar contraseña</h2>
      <AccountForm />

      <h2 className="font-semibold mb-3 mt-8">Notificaciones push</h2>
      <div className="card p-4">
        <p className="text-sm text-stone-500 mb-3">
          Recibe avisos al instante (horario publicado, vacaciones aprobadas, documentos nuevos…) en este dispositivo.
        </p>
        <PushManager />
      </div>
    </>
  );
}
