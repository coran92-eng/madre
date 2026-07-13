"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, clientIp } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

export async function resetPassword(
  _prev: { ok?: boolean; error?: string },
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const user = await prisma.user.findUnique({ where: { resetToken: d.token } });
  if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
    return { error: "El enlace no es válido o ha caducado. Solicita uno nuevo." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(d.password),
        resetToken: null,
        resetExpiresAt: null,
        mustChangePassword: false,
      },
    }),
    // Invalidate existing sessions after a reset.
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit({ actorId: user.id, actorEmail: user.email, action: "auth.reset.complete", entity: "User", entityId: user.id, ip: clientIp() });
  return { ok: true };
}
