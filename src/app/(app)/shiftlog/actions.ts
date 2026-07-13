"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const schema = z.object({
  shift: z.string().optional(),
  body: z.string().min(2, "Escribe el parte"),
});

export async function postLog(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true, localId: true, firstName: true, lastName: true } });
  const localId = employee?.localId ?? user.localId;
  if (!localId) return { error: "Tu cuenta no está asociada a un local." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const log = await prisma.shiftLog.create({
    data: {
      localId,
      businessDate: new Date(new Date().toDateString()),
      shift: d.shift || null,
      body: d.body,
      authorId: user.id,
      authorName: employee ? `${employee.firstName} ${employee.lastName}` : user.email,
    },
  });
  await audit({ ...auditContext(user), localId, action: "shiftlog.post", entity: "ShiftLog", entityId: log.id });
  revalidatePath("/shiftlog");
  return { ok: true };
}

export async function markLogRead(logId: string): Promise<void> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) return; // admins sin ficha no marcan lectura
  const log = await prisma.shiftLog.findUnique({ where: { id: logId } });
  if (!log || !canAccessLocal(user, log.localId)) throw new Error("Sin permiso.");
  await prisma.shiftLogRead.upsert({
    where: { logId_employeeId: { logId, employeeId: employee.id } },
    create: { logId, employeeId: employee.id },
    update: {},
  });
  revalidatePath("/shiftlog");
}

export async function deleteLog(id: string): Promise<void> {
  const user = await requireUser();
  const log = await prisma.shiftLog.findUnique({ where: { id } });
  if (!log) throw new Error("No encontrado.");
  const isAuthor = log.authorId === user.id;
  const isAdmin = user.role === "SUPERADMIN" || user.role === "ENCARGADO";
  if (!isAuthor && !isAdmin) throw new Error("Sin permiso.");
  if (isAdmin && !canAccessLocal(user, log.localId)) throw new Error("Sin permiso.");
  await prisma.shiftLog.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: log.localId, action: "shiftlog.delete", entity: "ShiftLog", entityId: id });
  revalidatePath("/shiftlog");
}
