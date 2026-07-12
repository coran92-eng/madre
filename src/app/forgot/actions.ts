"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendMail } from "@/lib/mailer";
import { clientIp } from "@/lib/auth";

const schema = z.object({ email: z.string().email() });

const GENERIC = { ok: true as const };

export async function requestPasswordReset(
  _prev: { ok?: boolean; error?: string },
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  // Always respond the same way — never reveal whether the email exists.
  if (!parsed.success) return GENERIC;

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.active) {
    const token = randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetExpiresAt: new Date(Date.now() + 3600 * 1000) },
    });
    const h = headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("host") ?? "localhost:3000";
    const url = `${proto}://${host}/reset?token=${token}`;
    await sendMail(
      email,
      "MADRE · Restablecer contraseña",
      `Has solicitado restablecer tu contraseña.\n\nAbre este enlace (válido 1 hora):\n${url}\n\nSi no has sido tú, ignora este mensaje.`
    );
    await audit({ actorId: user.id, actorEmail: email, action: "auth.reset.request", entity: "User", entityId: user.id, ip: clientIp() });
  }
  return GENERIC;
}
