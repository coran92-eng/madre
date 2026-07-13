"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

async function currentEmployee(userId: string) {
  return prisma.employee.findUnique({ where: { userId } });
}

/** Employee proposes to hand one of their shifts to a colleague (spec §4.3). */
export async function proposeSwap(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const me = await currentEmployee(user.id);
  if (!me || me.deletedAt) return { error: "Sin ficha de empleado." };

  const shiftId = String(formData.get("shiftId") ?? "");
  const targetEmployeeId = String(formData.get("targetEmployeeId") ?? "");
  const note = String(formData.get("note") ?? "");

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.employeeId !== me.id) return { error: "Turno no válido." };
  if (shift.date < new Date(new Date().toDateString())) return { error: "No se puede cambiar un turno pasado." };

  const target = await prisma.employee.findUnique({ where: { id: targetEmployeeId } });
  if (!target || target.deletedAt || target.localId !== me.localId || target.id === me.id) {
    return { error: "Compañero no válido." };
  }

  const swap = await prisma.shiftSwap.create({
    data: { localId: me.localId, shiftId, requestedById: me.id, targetEmployeeId, note: note || null },
  });
  await audit({ ...auditContext(user), localId: me.localId, action: "swap.propose", entity: "ShiftSwap", entityId: swap.id });
  if (target.email) {
    await notify(target.email, "Propuesta de cambio de turno", `${me.firstName} ${me.lastName} te propone cubrir un turno. Entra en MADRE para aceptarlo o rechazarlo.`);
  }
  revalidatePath("/swaps");
  return { ok: true };
}

/** Target colleague accepts or rejects the proposal. */
export async function respondSwap(id: string, accept: boolean): Promise<void> {
  const user = await requireUser();
  const me = await currentEmployee(user.id);
  const swap = await prisma.shiftSwap.findUnique({ where: { id } });
  if (!swap || !me || swap.targetEmployeeId !== me.id) throw new Error("Sin permiso.");
  if (swap.status !== "PROPUESTO") throw new Error("La propuesta ya no está abierta.");

  await prisma.shiftSwap.update({
    where: { id },
    data: { status: accept ? "ACEPTADO_COMPANERO" : "RECHAZADO_COMPANERO", companionAt: new Date() },
  });
  await audit({ ...auditContext(user), localId: swap.localId, action: accept ? "swap.accept" : "swap.reject_companion", entity: "ShiftSwap", entityId: id });

  const requester = await prisma.employee.findUnique({ where: { id: swap.requestedById } });
  if (requester?.email) {
    await notify(requester.email, "Respuesta a tu cambio de turno", accept
      ? "Tu compañero ha aceptado. Falta el visto bueno del encargado."
      : "Tu compañero ha rechazado la propuesta de cambio.");
  }
  revalidatePath("/swaps");
}

/** Manager gives (or denies) the final go-ahead; on approval the shift is reassigned. */
export async function decideSwap(id: string, approve: boolean): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const swap = await prisma.shiftSwap.findUnique({ where: { id } });
  if (!swap || !canAccessLocal(user, swap.localId)) return { error: "Sin permiso." };
  if (swap.status !== "ACEPTADO_COMPANERO") return { error: "El compañero aún no ha aceptado." };

  if (approve) {
    await prisma.$transaction([
      prisma.shift.update({ where: { id: swap.shiftId }, data: { employeeId: swap.targetEmployeeId } }),
      prisma.shiftSwap.update({ where: { id }, data: { status: "APROBADO", decidedById: user.id, decidedAt: new Date() } }),
    ]);
  } else {
    await prisma.shiftSwap.update({ where: { id }, data: { status: "RECHAZADO_ENCARGADO", decidedById: user.id, decidedAt: new Date() } });
  }
  await audit({ ...auditContext(user), localId: swap.localId, action: approve ? "swap.approve" : "swap.reject_manager", entity: "ShiftSwap", entityId: id });

  for (const empId of [swap.requestedById, swap.targetEmployeeId]) {
    const e = await prisma.employee.findUnique({ where: { id: empId } });
    if (e?.email) await notify(e.email, "Cambio de turno resuelto", approve ? "El encargado ha aprobado el cambio. El cuadrante ya está actualizado." : "El encargado no ha aprobado el cambio.");
  }
  revalidatePath("/swaps");
  revalidatePath("/schedule");
  return { ok: true };
}

export async function cancelSwap(id: string): Promise<void> {
  const user = await requireUser();
  const me = await currentEmployee(user.id);
  const swap = await prisma.shiftSwap.findUnique({ where: { id } });
  if (!swap) throw new Error("No encontrado.");
  const isOwner = me && swap.requestedById === me.id;
  const isAdmin = user.role === "SUPERADMIN" || user.role === "ENCARGADO";
  if (!isOwner && !isAdmin) throw new Error("Sin permiso.");
  await prisma.shiftSwap.update({ where: { id }, data: { status: "CANCELADO" } });
  await audit({ ...auditContext(user), localId: swap.localId, action: "swap.cancel", entity: "ShiftSwap", entityId: id });
  revalidatePath("/swaps");
}
