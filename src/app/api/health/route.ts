import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyMailer } from "@/lib/mailer";

// Sin esto, Next.js prerenderiza esta ruta UNA VEZ en el build (no lee
// request/cookies/headers) y sirve esa respuesta congelada para siempre —
// justo lo contrario de lo que necesita un endpoint de diagnóstico en vivo.
export const dynamic = "force-dynamic";

// Diagnóstico de despliegue: no requiere autenticación a propósito, para poder
// detectar el problema ANTES de poder entrar a la app (p.ej. tras un despliegue
// nuevo en Netlify). Nunca devuelve secretos, solo si están presentes o no.
export async function GET() {
  // NETLIFY_BLOBS_CONTEXT es la señal que usa la propia librería @netlify/blobs
  // para autoconfigurarse — a diferencia de la variable genérica NETLIFY, que
  // no está garantizado que llegue al runtime de la función (solo al build).
  // Ver src/lib/storage.ts.
  const onNetlify = !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY);
  const checks: Record<string, string> = {
    DATABASE_URL: process.env.DATABASE_URL ? "configurada" : "❌ FALTA",
    SESSION_SECRET: process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16 ? "configurada" : "❌ FALTA o demasiado corta (mín. 16)",
    STORAGE_DIR: onNetlify ? "Netlify Blobs (automático)" : process.env.STORAGE_DIR ? "configurada" : "usa ./storage por defecto",
    SMTP_URL: process.env.SMTP_URL ? "configurada" : "sin configurar (email va a consola)",
    runtime: onNetlify ? "Netlify Functions" : "otro (Docker/VPS/local)",
  };

  let db: string;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "✅ conectada";
  } catch (err) {
    db = `❌ NO ALCANZABLE: ${err instanceof Error ? err.message.split("\n")[0] : "error desconocido"}`;
  }

  // Comprueba conexión + autenticación SMTP SIN enviar un email (transporter.verify()).
  // Así se ve el motivo real (credenciales, remitente sin validar, puerto bloqueado...)
  // en vez de que el email desaparezca silenciosamente en los logs de la función.
  const mail = await verifyMailer();
  const smtp = !mail.configured
    ? "sin configurar (email va a consola)"
    : mail.ok
      ? "✅ conecta y autentica correctamente"
      : `❌ FALLA: ${mail.error}`;

  const ok = checks.DATABASE_URL === "configurada" && checks.SESSION_SECRET === "configurada" && db.startsWith("✅");

  return NextResponse.json({ ok, env: checks, database: db, smtp }, { status: ok ? 200 : 503 });
}
