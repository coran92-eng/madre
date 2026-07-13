import type { Role } from "@prisma/client";
import type { SessionUser } from "./auth";

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "Superadmin",
  ENCARGADO: "Encargado",
  EMPLEADO: "Empleado",
  GESTORIA: "Gestoría",
};

export function isAdmin(user: SessionUser): boolean {
  return user.role === "SUPERADMIN" || user.role === "ENCARGADO";
}

export function canManageEmployees(user: SessionUser): boolean {
  return isAdmin(user);
}

export function canApprove(user: SessionUser): boolean {
  return isAdmin(user);
}

/**
 * Prisma `where` fragment that scopes a query to the locals a user may see.
 * Superadmin: all locals. Everyone else: only their own local.
 */
export function localScope(user: SessionUser): { localId?: string } {
  if (user.role === "SUPERADMIN") return {};
  return { localId: user.localId ?? "__none__" };
}

/** True if the user is allowed to act on data belonging to `localId`. */
export function canAccessLocal(user: SessionUser, localId: string): boolean {
  if (user.role === "SUPERADMIN") return true;
  return user.localId === localId;
}
