"use server";

import * as QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireUser, hashPassword, auditContext } from "@/lib/auth";
import { generateTotpSecret, totpKeyUri, verifyTotp, generateBackupCodes } from "@/lib/twofactor";
import { audit } from "@/lib/audit";

export async function startTotpSetup(): Promise<{ secret: string; otpauthUri: string; qrDataUrl: string }> {
  const user = await requireUser();
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  const otpauthUri = totpKeyUri(user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUri);
  return { secret, otpauthUri, qrDataUrl };
}

export async function confirmTotpSetup(token: string): Promise<{ ok: boolean; error?: string; backupCodes?: string[] }> {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user?.totpSecret) return { ok: false, error: "Primero inicia la activación de 2FA." };

  if (!verifyTotp(token, user.totpSecret)) {
    return { ok: false, error: "El código introducido no es válido." };
  }

  const backupCodes = generateBackupCodes(8);
  const hashedCodes = await Promise.all(backupCodes.map((c) => hashPassword(c)));

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpBackupCodes: hashedCodes },
  });
  await audit({ ...auditContext(sessionUser), action: "security.2fa.enable", entity: "User", entityId: user.id });

  return { ok: true, backupCodes };
}

export async function disableTotp(): Promise<{ ok: boolean }> {
  const sessionUser = await requireUser();
  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
  });
  await audit({ ...auditContext(sessionUser), action: "security.2fa.disable", entity: "User", entityId: sessionUser.id });
  return { ok: true };
}
