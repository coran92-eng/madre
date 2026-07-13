"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import type { Role } from "@prisma/client";
import { logout, setLang } from "@/app/(app)/actions";
import { selectActiveLocal } from "@/app/(app)/locals/actions";
import { t, LANGS, type Lang } from "@/lib/i18n";

type Item = { href: string; key: string; roles: Role[] };

const ALL: Role[] = ["SUPERADMIN", "ENCARGADO", "EMPLEADO", "GESTORIA"];
const STAFF: Role[] = ["SUPERADMIN", "ENCARGADO", "EMPLEADO"];
const ADMIN: Role[] = ["SUPERADMIN", "ENCARGADO"];

const ITEMS: Item[] = [
  { href: "/dashboard", key: "nav.dashboard", roles: ALL },
  { href: "/panel", key: "nav.panel", roles: ADMIN },
  { href: "/employees", key: "nav.employees", roles: ADMIN },
  { href: "/onboarding", key: "nav.onboarding", roles: ADMIN },
  { href: "/vacations", key: "nav.vacations", roles: STAFF },
  { href: "/absences", key: "nav.absences", roles: STAFF },
  { href: "/schedule", key: "nav.schedule", roles: STAFF },
  { href: "/swaps", key: "nav.swaps", roles: STAFF },
  { href: "/timeclock", key: "nav.timeclock", roles: ["SUPERADMIN", "ENCARGADO", "EMPLEADO", "GESTORIA"] },
  { href: "/tips", key: "nav.tips", roles: STAFF },
  { href: "/checklists", key: "nav.checklists", roles: STAFF },
  { href: "/appcc", key: "nav.appcc", roles: STAFF },
  { href: "/shiftlog", key: "nav.shiftlog", roles: STAFF },
  { href: "/documents", key: "nav.documents", roles: ALL },
  { href: "/contratacion", key: "nav.contratacion", roles: ["SUPERADMIN", "ENCARGADO", "GESTORIA"] },
  { href: "/manual", key: "nav.manual", roles: STAFF },
  { href: "/board", key: "nav.board", roles: ALL },
  { href: "/cash", key: "nav.cash", roles: ADMIN },
  { href: "/alerts", key: "nav.alerts", roles: ADMIN },
  { href: "/training", key: "nav.training", roles: ADMIN },
  { href: "/incidents", key: "nav.incidents", roles: ADMIN },
  { href: "/locals", key: "nav.locals", roles: ["SUPERADMIN"] },
  { href: "/users", key: "nav.users", roles: ["SUPERADMIN"] },
  { href: "/audit", key: "nav.audit", roles: ["SUPERADMIN"] },
];

function LanguageSwitcher({ lang }: { lang: Lang }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={lang}
      disabled={pending}
      onChange={(e) => start(() => setLang(e.target.value))}
      className="bg-transparent text-stone-400 text-xs border-0 focus:ring-0 cursor-pointer"
      title="Idioma"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code} className="text-stone-900">{l.label}</option>
      ))}
    </select>
  );
}

function LocalSwitcher({ locals, value, lang }: { locals: { id: string; name: string }[]; value: string; lang: Lang }) {
  const [pending, start] = useTransition();
  if (locals.length < 2) return null;
  return (
    <div className="px-3 md:px-4 pb-2">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => start(() => selectActiveLocal(e.target.value))}
        className="w-full rounded-md bg-white/10 text-stone-100 text-sm px-2 py-1.5 border border-white/10"
        title={t(lang, "chrome.activeLocal")}
      >
        <option value="__ALL__" className="text-stone-900">{t(lang, "chrome.allLocals")}</option>
        {locals.map((l) => (
          <option key={l.id} value={l.id} className="text-stone-900">{l.name}</option>
        ))}
      </select>
    </div>
  );
}

export default function Nav({
  role,
  email,
  localName,
  locals = [],
  switcherValue = "__ALL__",
  lang = "es",
}: {
  role: Role;
  email: string;
  localName: string;
  locals?: { id: string; name: string }[];
  switcherValue?: string;
  lang?: Lang;
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
      {role === "SUPERADMIN" && <LocalSwitcher locals={locals} value={switcherValue} lang={lang} />}
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
              {t(lang, i.key)}
            </Link>
          );
        })}
      </nav>
      <div className="hidden md:block p-3 border-t border-white/10 text-xs space-y-2">
        <Link href="/account" className="block truncate text-stone-300 hover:text-white" title={email}>{email}</Link>
        <div className="flex items-center justify-between">
          <form action={logout}>
            <button className="text-stone-400 hover:text-white underline">{t(lang, "chrome.logout")}</button>
          </form>
          <LanguageSwitcher lang={lang} />
        </div>
      </div>
    </aside>
  );
}
