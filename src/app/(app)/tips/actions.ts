"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Create a tip pool and distribute it (spec: propinas). Methods:
 *  - EQUAL: partes iguales.
 *  - BY_HOURS: proporcional a minutos fichados ese día.
 *  - MANUAL: importe por persona (campo amount_<id>).
 * Rounding residue goes to the first participant so the shares sum the total.
 */
export async function createTipPool(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const localId = String(formData.get("localId") ?? "");
  if (!canAccessLocal(user, localId)) return { error: "Sin permiso." };

  const dateStr = String(formData.get("businessDate") ?? "");
  const date = new Date(dateStr + "T00:00:00Z");
  if (isNaN(date.getTime())) return { error: "Fecha no válida." };
  const shift = String(formData.get("shift") ?? "") || null;
  const method = String(formData.get("method") ?? "EQUAL") as "EQUAL" | "BY_HOURS" | "MANUAL";
  const participants = formData.getAll("participants").map(String);
  if (participants.length === 0) return { error: "Selecciona al menos un participante." };

  // Validate participants belong to the local.
  const emps = await prisma.employee.findMany({ where: { id: { in: participants }, localId, deletedAt: null }, select: { id: true, email: true } });
  if (emps.length !== participants.length) return { error: "Hay participantes no válidos." };

  let shares: { employeeId: string; amount: number }[] = [];
  let total = 0;

  if (method === "MANUAL") {
    for (const id of participants) {
      const amt = Number(formData.get(`amount_${id}`) ?? 0);
      if (isNaN(amt) || amt < 0) return { error: "Importes manuales no válidos." };
      shares.push({ employeeId: id, amount: round2(amt) });
    }
    total = round2(shares.reduce((a, s) => a + s.amount, 0));
    if (total <= 0) return { error: "El total debe ser mayor que 0." };
  } else {
    total = round2(Number(formData.get("totalAmount") ?? 0));
    if (isNaN(total) || total <= 0) return { error: "Indica el importe total del bote." };

    if (method === "EQUAL") {
      const per = round2(total / participants.length);
      shares = participants.map((id) => ({ employeeId: id, amount: per }));
    } else {
      // BY_HOURS: minutos fichados ese día.
      const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const dayEnd = new Date(dayStart); dayEnd.setUTCDate(dayStart.getUTCDate() + 1);
      const entries = await prisma.timeEntry.findMany({
        where: { employeeId: { in: participants }, clockIn: { gte: dayStart, lt: dayEnd }, clockOut: { not: null } },
        select: { employeeId: true, clockIn: true, clockOut: true },
      });
      const mins = new Map<string, number>();
      for (const e of entries) {
        const m = Math.max(0, Math.round((e.clockOut!.getTime() - e.clockIn.getTime()) / 60000));
        mins.set(e.employeeId, (mins.get(e.employeeId) ?? 0) + m);
      }
      const totalMins = participants.reduce((a, id) => a + (mins.get(id) ?? 0), 0);
      if (totalMins === 0) return { error: "No hay horas fichadas ese día para repartir por horas." };
      shares = participants.map((id) => ({ employeeId: id, amount: round2((total * (mins.get(id) ?? 0)) / totalMins) }));
    }
  }

  // Fix rounding residue on the first share.
  const sum = round2(shares.reduce((a, s) => a + s.amount, 0));
  const diff = round2(total - sum);
  if (diff !== 0 && shares.length > 0) shares[0].amount = round2(shares[0].amount + diff);

  const pool = await prisma.tipPool.create({
    data: {
      localId, businessDate: date, shift, totalAmount: total, method,
      note: String(formData.get("note") ?? "") || null,
      createdById: user.id,
      shares: { create: shares },
    },
  });
  await audit({ ...auditContext(user), localId, action: "tips.create", entity: "TipPool", entityId: pool.id, detail: { total, method, n: shares.length } });

  const byId = new Map(emps.map((e) => [e.id, e.email]));
  for (const s of shares) await notify(byId.get(s.employeeId), "Propinas repartidas", `Te corresponden ${s.amount.toFixed(2)} € de propinas${shift ? ` (${shift})` : ""}.`, "/tips");

  revalidatePath("/tips");
  return { ok: true };
}

export async function deleteTipPool(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const pool = await prisma.tipPool.findUnique({ where: { id } });
  if (!pool || !canAccessLocal(user, pool.localId)) throw new Error("Sin permiso.");
  await prisma.tipPool.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: pool.localId, action: "tips.delete", entity: "TipPool", entityId: id });
  revalidatePath("/tips");
}
