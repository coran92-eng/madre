import Link from "next/link";
import { prisma } from "@/lib/db";
import Kiosk from "./Kiosk";

export const dynamic = "force-dynamic";

// Tablet de barra. Ruta sin login, protegida por PIN individual (spec §4.4).
// Con varios locales, cada tablet fija el suyo con /kiosk?local=CODIGO
// (la primera vez se muestra un selector).
export default async function KioskPage({ searchParams }: { searchParams: { local?: string } }) {
  const actives = await prisma.local.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, name: true },
  });
  if (actives.length === 0) {
    return <main className="min-h-screen grid place-items-center bg-madre-900 text-white">No hay local configurado.</main>;
  }

  const local = searchParams.local
    ? actives.find((l) => l.code === searchParams.local!.toUpperCase()) ?? null
    : actives.length === 1
      ? actives[0]
      : null;

  // Varios locales y ninguno elegido → selector de centro (se fija por URL).
  if (!local) {
    return (
      <main className="min-h-screen bg-madre-900 text-white flex flex-col items-center justify-center p-6">
        <div className="font-serif text-3xl font-bold mb-1">MADRE · Fichaje</div>
        <p className="text-stone-300 text-sm mb-6">Elige el centro de esta tablet</p>
        <div className="grid gap-3 w-full max-w-sm">
          {actives.map((l) => (
            <Link key={l.id} href={`/kiosk?local=${l.code}`} className="rounded-xl bg-white/10 hover:bg-white/20 p-5 text-lg font-medium text-center transition">
              {l.name}
              <span className="block text-xs text-stone-400 mt-1">{l.code}</span>
            </Link>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-6 max-w-sm text-center">
          Guarda la página resultante como acceso directo en la pantalla de inicio de la tablet
          para que quede fijada a este centro.
        </p>
      </main>
    );
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
