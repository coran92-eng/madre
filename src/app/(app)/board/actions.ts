"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const schema = z.object({
  localId: z.string().optional(), // vacío = todos los locales (solo superadmin)
  title: z.string().min(2, "Título requerido"),
  body: z.string().min(1, "Escribe el comunicado"),
  requiresRead: z.string().optional(),
});

export async function createAnnouncement(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  // Encargado siempre publica en su local; solo superadmin puede publicar global.
  let localId: string | null;
  if (user.role === "SUPERADMIN") {
    localId = d.localId && d.localId !== "ALL" ? d.localId : null;
  } else {
    localId = user.localId ?? null;
  }
  if (localId && !canAccessLocal(user, localId)) return { error: "Sin permiso sobre ese local." };

  const a = await prisma.announcement.create({
    data: {
      localId, title: d.title, body: d.body,
      requiresRead: d.requiresRead === "on",
      createdById: user.id, createdByEmail: user.email,
    },
  });
  await audit({ ...auditContext(user), localId, action: "announcement.create", entity: "Announcement", entityId: a.id });
  revalidatePath("/board");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) throw new Error("No encontrado.");
  if (a.localId && !canAccessLocal(user, a.localId)) throw new Error("Sin permiso.");
  if (!a.localId && user.role !== "SUPERADMIN") throw new Error("Sin permiso.");
  await prisma.announcement.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: a.localId, action: "announcement.delete", entity: "Announcement", entityId: id });
  revalidatePath("/board");
}

export async function markAnnouncementRead(announcementId: string): Promise<void> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) throw new Error("Sin ficha de empleado.");
  await prisma.announcementRead.upsert({
    where: { announcementId_employeeId: { announcementId, employeeId: employee.id } },
    create: { announcementId, employeeId: employee.id },
    update: {},
  });
  await audit({ ...auditContext(user), localId: employee.localId, action: "announcement.read", entity: "Announcement", entityId: announcementId });
  revalidatePath("/board");
}
