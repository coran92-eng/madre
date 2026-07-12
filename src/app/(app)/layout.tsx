import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let localName = "Todos los locales";
  if (user.localId) {
    const local = await prisma.local.findUnique({ where: { id: user.localId } });
    localName = local?.name ?? "—";
  }

  return (
    <div className="md:flex min-h-screen">
      <Nav role={user.role} email={user.email} localName={localName} />
      <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
        {user.mustChangePassword && (
          <div className="mb-6 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            Estás usando una contraseña temporal.{" "}
            <a href="/account" className="underline font-medium">Cámbiala ahora</a> por seguridad.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
