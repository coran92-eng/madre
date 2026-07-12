import { prisma } from "@/lib/db";
import Kiosk from "./Kiosk";

export const dynamic = "force-dynamic";

// Tablet de barra. Ruta sin login, protegida por PIN individual (spec §4.4).
export default async function KioskPage({ searchParams }: { searchParams: { local?: string } }) {
  const local = searchParams.local
    ? await prisma.local.findUnique({ where: { code: searchParams.local.toUpperCase() } })
    : await prisma.local.findFirst({ orderBy: { createdAt: "asc" } });

  if (!local) {
    return <main className="min-h-screen grid place-items-center bg-madre-900 text-white">No hay local configurado.</main>;
  }

  const employees = await prisma.employee.findMany({
    where: { localId: local.id, deletedAt: null, status: "ACTIVO" },
    orderBy: [{ firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, timeEntries: { where: { clockOut: null }, select: { id: true }, take: 1 } },
  });

  return (
    <Kiosk
      localName={local.name}
      employees={employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, hasOpen: e.timeEntries.length > 0 }))}
    />
  );
}
