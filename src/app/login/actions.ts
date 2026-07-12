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
  if (!user || !user.active) {
    await audit({ action: "auth.login.fail", entity: "User", detail: { email }, ip: clientIp() });
    return invalid;
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await audit({ actorEmail: email, action: "auth.login.fail", entity: "User", entityId: user.id, ip: clientIp() });
    return invalid;
  }

  await createSession(user.id);
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    localId: user.localId,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
    ip: clientIp(),
  });
  redirect("/dashboard");
}
