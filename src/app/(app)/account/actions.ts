"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, verifyPassword, hashPassword, auditContext } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z
  .object({
    current: z.string().min(1, "Introduce tu contraseña actual"),
    next: z.string().min(8, "La nueva contraseña debe tener 8+ caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

export async function changePassword(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const sessionUser = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return { error: "Usuario no encontrado." };
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { error: "La contraseña actual no es correcta." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  await audit({ ...auditContext(sessionUser), localId: user.localId, action: "auth.password_change", entity: "User", entityId: user.id });
  return { ok: true };
}

// ── Notificaciones push (Web Push) ──────────────────────────────────────────

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  await audit({ ...auditContext(user), action: "push.subscribe", entity: "PushSubscription" });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return { ok: true };
}
