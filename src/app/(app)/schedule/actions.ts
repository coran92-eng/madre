"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const shiftSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inicio HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora fin HH:mm"),
  note: z.string().optional(),
});

export async function addShift(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = shiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (d.endTime <= d.startTime) return { error: "La hora de fin debe ser posterior a la de inicio." };

  const emp = await prisma.employee.findUnique({ where: { id: d.employeeId } });
  if (!emp || emp.deletedAt || !canAccessLocal(user, emp.localId)) return { error: "Empleado no válido." };

  const shift = await prisma.shift.create({
    data: {
      localId: emp.localId,
      employeeId: emp.id,
      date: new Date(d.date + "T00:00:00.000Z"),
      startTime: d.startTime,
      endTime: d.endTime,
      note: d.note || null,
      createdById: user.id,
    },
  });
  await audit({ ...auditContext(user), localId: emp.localId, action: "shift.create", entity: "Shift", entityId: shift.id, detail: { date: d.date } });
  revalidatePath("/schedule");
  return { ok: true };
}

export async function deleteShift(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift || !canAccessLocal(user, shift.localId)) throw new Error("Sin permiso.");
  await prisma.shift.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: shift.localId, action: "shift.delete", entity: "Shift", entityId: id });
  revalidatePath("/schedule");
}

/** Publish every shift of a week (notifies affected employees — spec §4.3). */
export async function publishWeek(localId: string, fromISO: string, toISO: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  if (!canAccessLocal(user, localId)) throw new Error("Sin permiso.");
  const res = await prisma.shift.updateMany({
    where: { localId, published: false, date: { gte: new Date(fromISO), lte: new Date(toISO) } },
    data: { published: true },
  });
  await audit({ ...auditContext(user), localId, action: "schedule.publish", entity: "Shift", detail: { from: fromISO, to: toISO, count: res.count } });
  revalidatePath("/schedule");
}
