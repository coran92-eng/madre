import { prisma } from "@/lib/db";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { token: string } }) {
  const reg = await prisma.employeeRegistration.findUnique({ where: { token: params.token } });

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-serif font-bold text-madre">MADRE</h1>
          <p className="text-stone-500 text-sm mt-1">Alta de empleado</p>
        </div>

        {!reg ? (
          <Notice title="Enlace no válido" body="Comprueba que has copiado el enlace completo, o pide uno nuevo a tu responsable." />
        ) : reg.status === "RECHAZADA" ? (
          <Notice title="Solicitud no aceptada" body="Esta solicitud no ha sido aceptada. Contacta con tu responsable si crees que es un error." />
        ) : reg.status === "APROBADA" ? (
          <Notice title="Alta ya completada" body="Esta solicitud ya se aprobó y tu acceso fue enviado por email. Si no lo encuentras, contacta con tu responsable." />
        ) : reg.expiresAt < new Date() ? (
          <Notice title="Enlace caducado" body="Este enlace ya no es válido. Pide uno nuevo a tu responsable." />
        ) : reg.submittedAt ? (
          <Notice title="Datos recibidos" body="Ya has enviado tus datos. Un responsable los revisará en breve y te llegará el acceso por email." />
        ) : (
          <JoinForm token={params.token} email={reg.email} />
        )}
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6 text-center">
      <h2 className="font-semibold text-stone-900">{title}</h2>
      <p className="text-sm text-stone-500 mt-2">{body}</p>
    </div>
  );
}
