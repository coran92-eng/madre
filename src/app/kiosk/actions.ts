"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/auth";

type ClockResult =
  | { ok: true; action: "in" | "out"; name: string; at: string }
  | { ok: false; error: string };

/**
 * Tablet clock-in/out (spec §4.4). Unauthenticated route gated by a per-employee
 * PIN. No biometrics, no geolocation (AEPD criterion). Records are immutable:
 * a clock creates or closes a TimeEntry; edits happen only via annotated
 * corrections from the admin panel.
 */
export async function kioskClock(employeeId: string, pin: string): Promise<ClockResult> {
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "PIN no válido." };

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp || emp.deletedAt || emp.status !== "ACTIVO") return { ok: false, error: "Empleado no disponible." };
  if (!emp.pinHash) return { ok: false, error: "Sin PIN configurado. Avisa al encargado." };
  if (!(await bcrypt.compare(pin, emp.pinHash))) return { ok: false, error: "PIN incorrecto." };

  const open = await prisma.timeEntry.findFirst({
    where: { employeeId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });

  const now = new Date();
  const name = `${emp.firstName} ${emp.lastName}`;
  const at = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

  if (open) {
    await prisma.timeEntry.update({ where: { id: open.id }, data: { clockOut: now } });
    await audit({ localId: emp.localId, action: "timeclock.out", entity: "TimeEntry", entityId: open.id, actorEmail: emp.email, ip: clientIp() });
    return { ok: true, action: "out", name, at };
  }

  const entry = await prisma.timeEntry.create({
    data: { localId: emp.localId, employeeId, clockIn: now, source: "TABLET" },
  });
  await audit({ localId: emp.localId, action: "timeclock.in", entity: "TimeEntry", entityId: entry.id, actorEmail: emp.email, ip: clientIp() });
  return { ok: true, action: "in", name, at };
}
