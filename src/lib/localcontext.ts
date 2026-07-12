import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { SessionUser } from "./auth";

const COOKIE = "madre_local";
export const ALL_LOCALS = "__ALL__";

async function rawChoice(): Promise<string | null> {
  const v = cookies().get(COOKIE)?.value;
  return v || null;
}

/**
 * The single local a config page operates on (always concrete).
 *  - Non-superadmin: their own local.
 *  - Superadmin: the chosen local, else the first one.
 */
export async function getActiveLocalId(user: SessionUser): Promise<string | null> {
  if (user.role !== "SUPERADMIN") return user.localId ?? null;

  const chosen = await rawChoice();
  if (chosen && chosen !== ALL_LOCALS) {
    const exists = await prisma.local.findUnique({ where: { id: chosen }, select: { id: true } });
    if (exists) return exists.id;
  }
  const first = await prisma.local.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return first?.id ?? null;
}

/**
 * Prisma `where` fragment for list pages. Honors the superadmin's local switcher:
 * a specific local narrows the list; "Todos" (or unset) shows all locals.
 */
export async function getListScope(user: SessionUser): Promise<{ localId?: string }> {
  if (user.role !== "SUPERADMIN") return { localId: user.localId ?? "__none__" };
  const chosen = await rawChoice();
  if (chosen && chosen !== ALL_LOCALS) {
    const exists = await prisma.local.findUnique({ where: { id: chosen }, select: { id: true } });
    if (exists) return { localId: chosen };
  }
  return {};
}

/** The switcher's current selection (concrete id or ALL_LOCALS). */
export async function getSwitcherValue(): Promise<string> {
  return (await rawChoice()) ?? ALL_LOCALS;
}

export { COOKIE as ACTIVE_LOCAL_COOKIE };
