"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ACTIVE_LOCAL_COOKIE } from "@/lib/localcontext";

const schema = z.object({
  code: z.string().min(2, "Código requerido").max(12),
  name: z.string().min(2, "Nombre requerido"),
  alertLeadDays: z.coerce.number().int().min(1).max(365).default(30),
  defaultHourlyCost: z.string().optional(),
});

export async function createLocal(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  const code = d.code.toUpperCase();
  if (await prisma.local.findUnique({ where: { code } })) return { error: "Ya existe un local con ese código." };

  const local = await prisma.local.create({
    data: {
      code,
      name: d.name,
      alertLeadDays: d.alertLeadDays,
      defaultHourlyCost: d.defaultHourlyCost ? Number(d.defaultHourlyCost) : null,
    },
  });
  await audit({ ...auditContext(user), localId: local.id, action: "local.create", entity: "Local", entityId: local.id, detail: { code } });
  revalidatePath("/locals");
  return { ok: true };
}

export async function updateLocal(
  id: string,
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  await prisma.local.update({
    where: { id },
    data: {
      name: d.name,
      alertLeadDays: d.alertLeadDays,
      defaultHourlyCost: d.defaultHourlyCost ? Number(d.defaultHourlyCost) : null,
    },
  });
  await audit({ ...auditContext(user), localId: id, action: "local.update", entity: "Local", entityId: id });
  revalidatePath("/locals");
  return { ok: true };
}

export async function setLocalActive(id: string, active: boolean): Promise<void> {
  const user = await requireRole("SUPERADMIN");
  await prisma.local.update({ where: { id }, data: { active } });
  await audit({ ...auditContext(user), localId: id, action: active ? "local.activate" : "local.deactivate", entity: "Local", entityId: id });
  revalidatePath("/locals");
}

/** Superadmin picks which local the single-local pages operate on. */
export async function selectActiveLocal(localId: string): Promise<void> {
  await requireRole("SUPERADMIN");
  cookies().set(ACTIVE_LOCAL_COOKIE, localId, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
