"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, clientIp } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Introduce email y contraseña." };

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Mensaje genérico para no revelar si el email existe.
  const invalid: LoginState = { error: "Credenciales incorrectas." };
  const locked: LoginState = { error: "Demasiados intentos. Inténtalo de nuevo en unos minutos." };
  if (!user || !user.active) {
    await audit({ action: "auth.login.fail", entity: "User", detail: { email }, ip: clientIp() });
    return invalid;
  }

  // Cuenta bloqueada temporalmente por intentos fallidos: no verifiques la
  // contraseña (evita dar pistas por timing) y corta aquí.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await audit({ actorEmail: email, action: "auth.login.blocked", entity: "User", entityId: user.id, ip: clientIp() });
    return locked;
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    const failedCount = user.failedLoginCount + 1;
    if (failedCount >= 5) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
      });
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: failedCount } });
    }
    await audit({ actorEmail: email, action: "auth.login.fail", entity: "User", entityId: user.id, ip: clientIp() });
    return invalid;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    localId: user.localId,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
    ip: clientIp(),
  });

  if (user.totpEnabled) {
    await createSession(user.id, { twoFactorVerified: false });
    redirect("/login/verify-2fa");
  }

  await createSession(user.id);
  redirect("/dashboard");
}
