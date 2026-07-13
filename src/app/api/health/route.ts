import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Diagnóstico de despliegue: no requiere autenticación a propósito, para poder
// detectar el problema ANTES de poder entrar a la app (p.ej. tras un despliegue
// nuevo en Netlify). Nunca devuelve secretos, solo si están presentes o no.
export async function GET() {
  const checks: Record<string, string> = {
    DATABASE_URL: process.env.DATABASE_URL ? "configurada" : "❌ FALTA",
    SESSION_SECRET: process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16 ? "configurada" : "❌ FALTA o demasiado corta (mín. 16)",
    STORAGE_DIR: process.env.NETLIFY ? "Netlify Blobs (automático)" : process.env.STORAGE_DIR ? "configurada" : "usa ./storage por defecto",
    SMTP_URL: process.env.SMTP_URL ? "configurada" : "sin configurar (email va a consola)",
    runtime: process.env.NETLIFY ? "Netlify Functions" : "otro (Docker/VPS/local)",
  };

  let db: string;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "✅ conectada";
  } catch (err) {
    db = `❌ NO ALCANZABLE: ${err instanceof Error ? err.message.split("\n")[0] : "error desconocido"}`;
  }

  const ok = checks.DATABASE_URL === "configurada" && checks.SESSION_SECRET === "configurada" && db.startsWith("✅");

  return NextResponse.json({ ok, env: checks, database: db }, { status: ok ? 200 : 503 });
}
