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
      <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  );
}
