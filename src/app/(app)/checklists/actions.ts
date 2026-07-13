"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

function today(): Date {
  return new Date(new Date().toDateString());
}

const tplSchema = z.object({
  localId: z.string().min(1),
  name: z.string().min(2, "Nombre requerido"),
  moment: z.enum(["APERTURA", "CIERRE", "OTRO"]),
  order: z.coerce.number().int().default(0),
});

export async function saveTemplate(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = tplSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (!canAccessLocal(user, d.localId)) return { error: "Sin permiso." };
  const id = String(formData.get("id") ?? "");
  if (id) {
    const cur = await prisma.checklistTemplate.findUnique({ where: { id } });
    if (!cur || !canAccessLocal(user, cur.localId)) return { error: "Sin permiso." };
    await prisma.checklistTemplate.update({ where: { id }, data: { name: d.name, moment: d.moment, order: d.order } });
  } else {
    await prisma.checklistTemplate.create({ data: { localId: d.localId, name: d.name, moment: d.moment, order: d.order, createdById: user.id } });
  }
  await audit({ ...auditContext(user), localId: d.localId, action: "checklist.template.save", entity: "ChecklistTemplate", entityId: id || undefined });
  revalidatePath("/checklists/config");
  return { ok: true };
}

export async function toggleTemplate(id: string, active: boolean): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const t = await prisma.checklistTemplate.findUnique({ where: { id } });
  if (!t || !canAccessLocal(user, t.localId)) throw new Error("Sin permiso.");
  await prisma.checklistTemplate.update({ where: { id }, data: { active } });
  await audit({ ...auditContext(user), localId: t.localId, action: active ? "checklist.template.activate" : "checklist.template.deactivate", entity: "ChecklistTemplate", entityId: id });
  revalidatePath("/checklists/config");
}

export async function addItem(templateId: string, label: string): Promise<{ error?: string }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const t = await prisma.checklistTemplate.findUnique({ where: { id: templateId }, include: { _count: { select: { items: true } } } });
  if (!t || !canAccessLocal(user, t.localId)) return { error: "Sin permiso." };
  if (label.trim().length < 2) return { error: "Escribe la tarea." };
  await prisma.checklistItem.create({ data: { templateId, label: label.trim(), order: t._count.items } });
  await audit({ ...auditContext(user), localId: t.localId, action: "checklist.item.add", entity: "ChecklistTemplate", entityId: templateId });
  revalidatePath("/checklists/config");
  return {};
}

export async function removeItem(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const item = await prisma.checklistItem.findUnique({ where: { id }, include: { template: true } });
  if (!item || !canAccessLocal(user, item.template.localId)) throw new Error("Sin permiso.");
  await prisma.checklistItem.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: item.template.localId, action: "checklist.item.remove", entity: "ChecklistItem", entityId: id });
  revalidatePath("/checklists/config");
}

/** Tick/untick an item for today's run (creating the run on first tick). */
export async function checkItem(itemId: string, checked: boolean): Promise<void> {
  const user = await requireUser();
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { template: true } });
  if (!item || !canAccessLocal(user, item.template.localId)) throw new Error("Sin permiso.");

  const run = await prisma.checklistRun.upsert({
    where: { templateId_businessDate: { templateId: item.templateId, businessDate: today() } },
    create: { localId: item.template.localId, templateId: item.templateId, businessDate: today() },
    update: {},
  });

  const emp = await prisma.employee.findUnique({ where: { userId: user.id }, select: { firstName: true, lastName: true } });
  const byName = emp ? `${emp.firstName} ${emp.lastName}` : user.email;

  await prisma.checklistCheck.upsert({
    where: { runId_itemId: { runId: run.id, itemId } },
    create: { runId: run.id, itemId, checked, byId: user.id, byName },
    update: { checked, byId: user.id, byName, at: new Date() },
  });
  await audit({ ...auditContext(user), localId: item.template.localId, action: "checklist.check", entity: "ChecklistItem", entityId: itemId, detail: { checked } });
  revalidatePath("/checklists");
}
