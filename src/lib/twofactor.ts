import "server-only";
import { randomBytes } from "crypto";
import { authenticator } from "otplib";

/** Genera un secreto TOTP nuevo (base32), para asociar a un usuario durante el alta de 2FA. */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** URI otpauth:// para generar el QR que escanea la app autenticadora. */
export function totpKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, "MADRE", secret);
}

/** Verifica un código TOTP de 6 dígitos contra el secreto del usuario. */
export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/** Genera N códigos de respaldo legibles tipo XXXX-XXXX, en texto plano. */
export function generateBackupCodes(n = 8): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const bytes = randomBytes(8);
    let out = "";
    for (let j = 0; j < 8; j++) out += alphabet[bytes[j] % alphabet.length];
    codes.push(`${out.slice(0, 4)}-${out.slice(4, 8)}`);
  }
  return codes;
}
