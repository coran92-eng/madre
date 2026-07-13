"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext, clientIp } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const pointSchema = z.object({
  localId: z.string().min(1),
  name: z.string().min(2, "Nombre requerido"),
  category: z.enum(["TEMPERATURA", "RECEPCION", "LIMPIEZA", "ACEITE", "TRAZABILIDAD", "OTRO"]),
  kind: z.enum(["NUMERIC", "BOOLEAN", "TEXT"]),
  unit: z.string().optional(),
  minValue: z.string().optional(),
  maxValue: z.string().optional(),
  frequency: z.enum(["POR_TURNO", "DIARIO", "SEMANAL"]),
  order: z.coerce.number().int().default(0),
});

function num(s?: string): number | null {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

export async function savePoint(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = pointSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (!canAccessLocal(user, d.localId)) return { error: "Sin permiso." };

  const id = String(formData.get("id") ?? "");
  const data = {
    localId: d.localId, name: d.name, category: d.category, kind: d.kind,
    unit: d.unit || null, minValue: num(d.minValue), maxValue: num(d.maxValue),
    frequency: d.frequency, order: d.order,
  };
  if (id) {
    const cur = await prisma.appccPoint.findUnique({ where: { id } });
    if (!cur || !canAccessLocal(user, cur.localId)) return { error: "Sin permiso." };
    await prisma.appccPoint.update({ where: { id }, data });
  } else {
    await prisma.appccPoint.create({ data: { ...data, createdById: user.id } });
  }
  await audit({ ...auditContext(user), localId: d.localId, action: "appcc.point.save", entity: "AppccPoint", entityId: id || undefined });
  revalidatePath("/appcc/config");
  revalidatePath("/appcc");
  return { ok: true };
}

export async function togglePoint(id: string, active: boolean): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const p = await prisma.appccPoint.findUnique({ where: { id } });
  if (!p || !canAccessLocal(user, p.localId)) throw new Error("Sin permiso.");
  await prisma.appccPoint.update({ where: { id }, data: { active } });
  await audit({ ...auditContext(user), localId: p.localId, action: active ? "appcc.point.activate" : "appcc.point.deactivate", entity: "AppccPoint", entityId: id });
  revalidatePath("/appcc/config");
  revalidatePath("/appcc");
}

/** Record a reading. Immutable; non-conformities alert the local's managers. */
export async function recordAppcc(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const pointId = String(formData.get("pointId") ?? "");
  const point = await prisma.appccPoint.findUnique({ where: { id: pointId } });
  if (!point || !point.active) return { error: "Punto de control no válido." };
  if (!canAccessLocal(user, point.localId)) return { error: "Sin permiso." };

  const raw = String(formData.get("value") ?? "");
  const note = String(formData.get("note") ?? "") || null;

  let numValue: number | null = null;
  let boolValue: boolean | null = null;
  let textValue: string | null = null;
  let ok = true;

  if (point.kind === "NUMERIC") {
    const n = Number(raw);
    if (isNaN(n)) return { error: "Introduce un valor numérico." };
    numValue = n;
    if (point.minValue != null && n < point.minValue) ok = false;
    if (point.maxValue != null && n > point.maxValue) ok = false;
  } else if (point.kind === "BOOLEAN") {
    boolValue = raw === "on" || raw === "true" || raw === "1";
    ok = boolValue;
  } else {
    textValue = raw.trim();
    if (!textValue) return { error: "Introduce el dato." };
  }

  const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { firstName: true, lastName: true } });
  const byName = employee ? `${employee.firstName} ${employee.lastName}` : user.email;

  const rec = await prisma.appccRecord.create({
    data: { localId: point.localId, pointId, numValue, boolValue, textValue, ok, note, recordedById: user.id, recordedByName: byName, ip: clientIp() },
  });
  await audit({ ...auditContext(user), localId: point.localId, action: "appcc.record", entity: "AppccRecord", entityId: rec.id, detail: { point: point.name, ok } });

  if (!ok) {
    const managers = await prisma.user.findMany({
      where: { active: true, role: { in: ["ENCARGADO", "SUPERADMIN"] }, OR: [{ localId: point.localId }, { role: "SUPERADMIN" }] },
      select: { email: true },
    });
    const val = point.kind === "NUMERIC" ? `${numValue}${point.unit ?? ""}` : "no conforme";
    for (const m of managers) await notify(m.email, "APPCC: registro fuera de umbral", `"${point.name}" registró ${val} (fuera de rango). Revisa el punto de control.`);
  }

  revalidatePath("/appcc");
  return { ok: true };
}
