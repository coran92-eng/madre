"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext, hashPassword, generatePassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  email: z.string().email("Email no válido"),
  role: z.enum(["SUPERADMIN", "ENCARGADO", "GESTORIA"]),
  localId: z.string().optional(),
});

/** Superadmin creates an admin/staff account (encargado, gestoría or another superadmin). */
export async function createUser(
  _prev: { error?: string; password?: string; email?: string },
  formData: FormData
): Promise<{ error?: string; password?: string; email?: string }> {
  const user = await requireRole("SUPERADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const email = d.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return { error: "Ese email ya está en uso." };

  // Encargado/gestoría need a local; superadmin spans all locals.
  let localId: string | null = null;
  if (d.role !== "SUPERADMIN") {
    if (!d.localId) return { error: "Selecciona un local." };
    const local = await prisma.local.findUnique({ where: { id: d.localId } });
    if (!local) return { error: "Local no válido." };
    localId = local.id;
  }

  const tempPassword = generatePassword();
  const created = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(tempPassword), role: d.role, localId, mustChangePassword: true },
  });
  await audit({ ...auditContext(user), localId, action: "user.create", entity: "User", entityId: created.id, detail: { role: d.role } });
  revalidatePath("/users");
  return { password: tempPassword, email };
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  const user = await requireRole("SUPERADMIN");
  if (id === user.id) throw new Error("No puedes desactivar tu propia cuenta.");
  await prisma.user.update({ where: { id }, data: { active } });
  if (!active) await prisma.session.deleteMany({ where: { userId: id } });
  await audit({ ...auditContext(user), action: active ? "user.activate" : "user.deactivate", entity: "User", entityId: id });
  revalidatePath("/users");
}

export async function resetUserPassword(id: string): Promise<{ error?: string; password?: string; email?: string }> {
  const user = await requireRole("SUPERADMIN");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "Usuario no encontrado." };
  const tempPassword = generatePassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, resetToken: null, resetExpiresAt: null } }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ]);
  await audit({ ...auditContext(user), localId: target.localId, action: "user.reset_password", entity: "User", entityId: id });
  revalidatePath("/users");
  return { password: tempPassword, email: target.email };
}

/** Superadmin reasigna el local de una cuenta (encargado/gestoría sin ficha). */
export async function setUserLocal(id: string, localId: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN");
  const target = await prisma.user.findUnique({ where: { id }, include: { employee: { select: { id: true } } } });
  if (!target) return { error: "Usuario no encontrado." };
  if (target.role === "SUPERADMIN") return { error: "El superadmin no está atado a un local." };
  if (target.employee) return { error: "Esta cuenta está vinculada a una ficha: traslada al empleado desde su ficha." };
  const local = await prisma.local.findUnique({ where: { id: localId } });
  if (!local || !local.active) return { error: "Local no válido." };
  await prisma.user.update({ where: { id }, data: { localId } });
  await audit({ ...auditContext(user), localId, action: "user.set_local", entity: "User", entityId: id });
  revalidatePath("/users");
  return { ok: true };
}
