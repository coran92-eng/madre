import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSwitcherValue } from "@/lib/localcontext";
import { LANG_COOKIE, normalizeLang, t } from "@/lib/i18n";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const lang = normalizeLang(cookies().get(LANG_COOKIE)?.value);
  let localName = t(lang, "chrome.allLocals");
  let locals: { id: string; name: string }[] = [];
  let switcherValue = "__ALL__";

  if (user.role === "SUPERADMIN") {
    locals = await prisma.local.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
    switcherValue = await getSwitcherValue();
    localName = locals.find((l) => l.id === switcherValue)?.name ?? t(lang, "chrome.allLocals");
  } else if (user.localId) {
    const local = await prisma.local.findUnique({ where: { id: user.localId } });
    localName = local?.name ?? "—";
  }

  return (
    <div className="md:flex min-h-screen">
      <Nav role={user.role} email={user.email} localName={localName} locals={locals} switcherValue={switcherValue} lang={lang} />
      <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
        {user.mustChangePassword && (
          <div className="mb-6 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            {t(lang, "chrome.tempPassword")}{" "}
            <a href="/account" className="underline font-medium">{t(lang, "chrome.changeNow")}</a>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
