import "server-only";
import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";

const COOKIE = "madre_session";
const SESSION_HOURS = 12; // sesión con expiración (spec §3)

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (min 16 chars).");
  }
  return s;
}

function sign(sessionId: string): string {
  const mac = createHmac("sha256", secret()).update(sessionId).digest("hex");
  return `${sessionId}.${mac}`;
}

function unsign(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const id = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(id).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generatePassword(len = 10): string {
  // legible, sin caracteres ambiguos — para provisión de acceso a empleados
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function clientIp(): string | null {
  const h = headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  const h = headers();
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      ip: clientIp(),
      userAgent: h.get("user-agent") ?? null,
    },
  });
  cookies().set(COOKIE, sign(session.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const raw = cookies().get(COOKIE)?.value;
  const id = unsign(raw);
  if (id) {
    await prisma.session.deleteMany({ where: { id } });
  }
  cookies().delete(COOKIE);
}

export type SessionUser = Pick<User, "id" | "email" | "role" | "localId" | "active" | "mustChangePassword">;

/** Returns the current user or null. Clears expired/invalid sessions. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const id = unsign(cookies().get(COOKIE)?.value);
  if (!id) return null;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || !session.user.active) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }
  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    localId: user.localId,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
  };
}

export class AuthError extends Error {}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("No autenticado");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError("Sin permiso");
  return user;
}

export function auditContext(user: SessionUser) {
  return { actorId: user.id, actorEmail: user.email, ip: clientIp() };
}

export { clientIp };
