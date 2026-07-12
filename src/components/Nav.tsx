"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { logout } from "@/app/(app)/actions";

type Item = { href: string; label: string; roles: Role[] };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Inicio", roles: ["SUPERADMIN", "ENCARGADO", "EMPLEADO", "GESTORIA"] },
  { href: "/employees", label: "Empleados", roles: ["SUPERADMIN", "ENCARGADO"] },
  { href: "/vacations", label: "Vacaciones", roles: ["SUPERADMIN", "ENCARGADO", "EMPLEADO"] },
  { href: "/schedule", label: "Horarios", roles: ["SUPERADMIN", "ENCARGADO", "EMPLEADO"] },
  { href: "/documents", label: "Documentos", roles: ["SUPERADMIN", "ENCARGADO", "EMPLEADO", "GESTORIA"] },
  { href: "/audit", label: "Actividad", roles: ["SUPERADMIN"] },
];

export default function Nav({
  role,
  email,
  localName,
}: {
  role: Role;
  email: string;
  localName: string;
}) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.roles.includes(role));

  return (
    <aside className="md:w-60 md:min-h-screen bg-madre-900 text-stone-200 flex md:flex-col shrink-0">
      <div className="p-4 md:p-6 flex md:block items-center justify-between w-full">
        <div>
          <div className="font-serif text-2xl font-bold text-white">MADRE</div>
          <div className="text-xs text-stone-400 mt-0.5">{localName}</div>
        </div>
      </div>
      <nav className="flex md:flex-col gap-1 px-2 md:px-3 overflow-x-auto flex-1">
        {items.map((i) => {
          const active = pathname === i.href || pathname.startsWith(i.href + "/");
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition ${
                active ? "bg-white/15 text-white font-medium" : "hover:bg-white/10"
              }`}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden md:block p-3 border-t border-white/10 text-xs">
        <Link href="/account" className="block truncate text-stone-300 hover:text-white" title={email}>{email}</Link>
        <form action={logout} className="mt-2">
          <button className="text-stone-400 hover:text-white underline">Cerrar sesión</button>
        </form>
      </div>
    </aside>
  );
}
