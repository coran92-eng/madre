"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/auth";

type ClockResult =
  | { ok: true; action: "in" | "out"; name: string; at: string }
  | { ok: false; error: string };

type Opts = { atISO?: string; action?: "in" | "out" };

/**
 * Tablet clock-in/out (spec §4.4). Unauthenticated route gated by a per-employee
 * PIN. No biometrics, no geolocation (AEPD criterion). Records are immutable:
 * a clock creates or closes a TimeEntry; edits happen only via annotated
 * corrections from the admin panel.
 *
 * Offline replay: when `opts.atISO` is given, the punch is applied at that
 * captured time (source TABLET_OFFLINE). The PIN is still verified server-side
 * on replay, so offline queuing never bypasses authentication. Timestamps are
 * clamped to a sane window to prevent backdating abuse.
 */
export async function kioskClock(employeeId: string, pin: string, opts: Opts = {}): Promise<ClockResult> {
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "PIN no válido." };

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp || emp.deletedAt || emp.status !== "ACTIVO") return { ok: false, error: "Empleado no disponible." };
  if (!emp.pinHash) return { ok: false, error: "Sin PIN configurado. Avisa al encargado." };
  if (!(await bcrypt.compare(pin, emp.pinHash))) return { ok: false, error: "PIN incorrecto." };

  const now = new Date();
  let when = now;
  let offline = false;
  if (opts.atISO) {
    const t = new Date(opts.atISO);
    if (isNaN(t.getTime())) return { ok: false, error: "Marca de tiempo no válida." };
    const min = new Date(now.getTime() - 48 * 3600 * 1000);
    const max = new Date(now.getTime() + 5 * 60 * 1000);
    if (t < min || t > max) return { ok: false, error: "Marca fuera de rango." };
    when = t;
    offline = true;
  }

  const open = await prisma.timeEntry.findFirst({
    where: { employeeId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  const source = offline ? "TABLET_OFFLINE" : "TABLET";
  const name = `${emp.firstName} ${emp.lastName}`;
  const at = when.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

  // Decide action: explicit intent (offline) or toggle by current state (online).
  const doOut = opts.action ? opts.action === "out" : !!open;

  if (doOut && open) {
    if (when < open.clockIn) return { ok: false, error: "La salida es anterior a la entrada." };
    await prisma.timeEntry.update({ where: { id: open.id }, data: { clockOut: when } });
    await audit({ localId: emp.localId, action: offline ? "timeclock.out.offline" : "timeclock.out", entity: "TimeEntry", entityId: open.id, actorEmail: emp.email, ip: clientIp() });
    return { ok: true, action: "out", name, at };
  }

  if (doOut && !open) {
    // Nothing to close (e.g. stale offline "out"). Ignore gracefully.
    return { ok: false, error: "No había fichaje abierto que cerrar." };
  }

  // Clock in.
  const entry = await prisma.timeEntry.create({
    data: { localId: emp.localId, employeeId, clockIn: when, source },
  });
  await audit({ localId: emp.localId, action: offline ? "timeclock.in.offline" : "timeclock.in", entity: "TimeEntry", entityId: entry.id, actorEmail: emp.email, ip: clientIp() });
  return { ok: true, action: "in", name, at };
}
