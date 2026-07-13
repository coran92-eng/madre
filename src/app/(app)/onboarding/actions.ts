"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const tplSchema = z.object({
  localId: z.string().min(1),
  name: z.string().min(2, "Nombre requerido"),
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
    const cur = await prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!cur || !canAccessLocal(user, cur.localId)) return { error: "Sin permiso." };
    await prisma.onboardingTemplate.update({ where: { id }, data: { name: d.name } });
  } else {
    await prisma.onboardingTemplate.create({ data: { localId: d.localId, name: d.name, createdById: user.id } });
  }
  await audit({ ...auditContext(user), localId: d.localId, action: "onboarding.template.save", entity: "OnboardingTemplate", entityId: id || undefined });
  revalidatePath("/onboarding/config");
  return { ok: true };
}

export async function toggleTemplate(id: string, active: boolean): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const t = await prisma.onboardingTemplate.findUnique({ where: { id } });
  if (!t || !canAccessLocal(user, t.localId)) throw new Error("Sin permiso.");
  await prisma.onboardingTemplate.update({ where: { id }, data: { active } });
  await audit({ ...auditContext(user), localId: t.localId, action: active ? "onboarding.template.activate" : "onboarding.template.deactivate", entity: "OnboardingTemplate", entityId: id });
  revalidatePath("/onboarding/config");
}

export async function addItem(templateId: string, label: string): Promise<{ error?: string }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const t = await prisma.onboardingTemplate.findUnique({ where: { id: templateId }, include: { _count: { select: { items: true } } } });
  if (!t || !canAccessLocal(user, t.localId)) return { error: "Sin permiso." };
  if (label.trim().length < 2) return { error: "Escribe la tarea." };
  await prisma.onboardingItem.create({ data: { templateId, label: label.trim(), order: t._count.items } });
  await audit({ ...auditContext(user), localId: t.localId, action: "onboarding.item.add", entity: "OnboardingTemplate", entityId: templateId });
  revalidatePath("/onboarding/config");
  return {};
}

export async function removeItem(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const item = await prisma.onboardingItem.findUnique({ where: { id }, include: { template: true } });
  if (!item || !canAccessLocal(user, item.template.localId)) throw new Error("Sin permiso.");
  await prisma.onboardingItem.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: item.template.localId, action: "onboarding.item.remove", entity: "OnboardingItem", entityId: id });
  revalidatePath("/onboarding/config");
}

/** Mark/unmark an onboarding item for a specific employee. */
export async function checkOnboarding(employeeId: string, itemId: string, done: boolean): Promise<void> {
  const user = await requireUser();
  const item = await prisma.onboardingItem.findUnique({ where: { id: itemId }, include: { template: true } });
  if (!item || !canAccessLocal(user, item.template.localId)) throw new Error("Sin permiso.");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { localId: true } });
  if (!employee || !canAccessLocal(user, employee.localId)) throw new Error("Sin permiso.");

  const emp = await prisma.employee.findUnique({ where: { userId: user.id }, select: { firstName: true, lastName: true } });
  const byName = emp ? `${emp.firstName} ${emp.lastName}` : user.email;

  await prisma.onboardingCheck.upsert({
    where: { employeeId_itemId: { employeeId, itemId } },
    create: { localId: item.template.localId, employeeId, itemId, done, byId: user.id, byName },
    update: { done, byId: user.id, byName, at: new Date() },
  });
  await audit({ ...auditContext(user), localId: item.template.localId, action: "onboarding.check", entity: "Employee", entityId: employeeId, detail: { itemId, done } });
  revalidatePath("/onboarding");
}
