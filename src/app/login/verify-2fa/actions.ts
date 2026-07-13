"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getPendingTwoFactorSession, verifyPassword, clientIp } from "@/lib/auth";
import { verifyTotp } from "@/lib/twofactor";
import { audit } from "@/lib/audit";

const schema = z.object({ code: z.string().min(1) });

export type VerifyTwoFactorState = { error?: string };

export async function verifyTwoFactor(
  _prev: VerifyTwoFactorState,
  formData: FormData
): Promise<VerifyTwoFactorState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Introduce el código." };

  const session = await getPendingTwoFactorSession();
  if (!session) return { error: "La sesión ha caducado. Vuelve a iniciar sesión." };

  const { user } = session;
  const code = parsed.data.code.trim();
  const invalid: VerifyTwoFactorState = { error: "Código no válido." };

  let verified = false;

  if (user.totpSecret && /^\d{6}$/.test(code) && verifyTotp(code, user.totpSecret)) {
    verified = true;
  }

  if (!verified && user.totpBackupCodes.length > 0) {
    for (const hash of user.totpBackupCodes) {
      if (await verifyPassword(code, hash)) {
        verified = true;
        // Un solo uso: elimina el código de respaldo consumido.
        const remaining = user.totpBackupCodes.filter((h) => h !== hash);
        await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: remaining } });
        break;
      }
    }
  }

  if (!verified) {
    await audit({ actorId: user.id, actorEmail: user.email, action: "security.2fa.fail", entity: "User", entityId: user.id, ip: clientIp() });
    return invalid;
  }

  await prisma.session.update({ where: { id: session.id }, data: { twoFactorVerified: true } });
  await audit({ actorId: user.id, actorEmail: user.email, action: "security.2fa.verify", entity: "User", entityId: user.id, ip: clientIp() });
  redirect("/dashboard");
}
