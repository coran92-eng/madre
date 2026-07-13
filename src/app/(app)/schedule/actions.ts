"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const shiftSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inicio HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora fin HH:mm"),
  note: z.string().optional(),
});

export async function addShift(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = shiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (d.endTime <= d.startTime) return { error: "La hora de fin debe ser posterior a la de inicio." };

  const emp = await prisma.employee.findUnique({ where: { id: d.employeeId } });
  if (!emp || emp.deletedAt || !canAccessLocal(user, emp.localId)) return { error: "Empleado no válido." };

  const shift = await prisma.shift.create({
    data: {
      localId: emp.localId,
      employeeId: emp.id,
      date: new Date(d.date + "T00:00:00.000Z"),
      startTime: d.startTime,
      endTime: d.endTime,
      note: d.note || null,
      createdById: user.id,
    },
  });
  await audit({ ...auditContext(user), localId: emp.localId, action: "shift.create", entity: "Shift", entityId: shift.id, detail: { date: d.date } });
  revalidatePath("/schedule");
  return { ok: true };
}

export async function deleteShift(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift || !canAccessLocal(user, shift.localId)) throw new Error("Sin permiso.");
  await prisma.shift.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: shift.localId, action: "shift.delete", entity: "Shift", entityId: id });
  revalidatePath("/schedule");
}

/** Publish every shift of a week (notifies affected employees — spec §4.3). */
export async function publishWeek(localId: string, fromISO: string, toISO: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  if (!canAccessLocal(user, localId)) throw new Error("Sin permiso.");
  // Employees affected by this publish (had unpublished shifts in the range).
  const affected = await prisma.shift.findMany({
    where: { localId, published: false, date: { gte: new Date(fromISO), lte: new Date(toISO) } },
    select: { employee: { select: { email: true } } },
    distinct: ["employeeId"],
  });
  const res = await prisma.shift.updateMany({
    where: { localId, published: false, date: { gte: new Date(fromISO), lte: new Date(toISO) } },
    data: { published: true },
  });
  await audit({ ...auditContext(user), localId, action: "schedule.publish", entity: "Shift", detail: { from: fromISO, to: toISO, count: res.count } });
  for (const a of affected) await notify(a.employee.email, "Horario publicado", "Tu encargado ha publicado el cuadrante de la semana. Consúltalo en MADRE.");
  revalidatePath("/schedule");
}

// ── Plantillas de semana tipo (spec §4.3) ───────────────────────────────────

function mondayUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

type TemplateShift = { employeeId: string; weekday: number; startTime: string; endTime: string; note: string | null };

/** Save the shifts of a given week as a reusable template. */
export async function saveTemplate(localId: string, name: string, weekISO: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  if (!canAccessLocal(user, localId)) return { error: "Sin permiso." };
  if (name.trim().length < 2) return { error: "Ponle un nombre a la plantilla." };

  const monday = mondayUTC(new Date(weekISO));
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  const shifts = await prisma.shift.findMany({ where: { localId, date: { gte: monday, lte: sunday } } });
  if (shifts.length === 0) return { error: "Esa semana no tiene turnos que guardar." };

  const data: TemplateShift[] = shifts.map((s) => ({
    employeeId: s.employeeId,
    weekday: Math.round((Date.UTC(s.date.getUTCFullYear(), s.date.getUTCMonth(), s.date.getUTCDate()) - monday.getTime()) / 86400000),
    startTime: s.startTime,
    endTime: s.endTime,
    note: s.note,
  }));

  const tpl = await prisma.scheduleTemplate.create({ data: { localId, name: name.trim(), data: data as never, createdById: user.id } });
  await audit({ ...auditContext(user), localId, action: "schedule.template.save", entity: "ScheduleTemplate", entityId: tpl.id, detail: { shifts: data.length } });
  revalidatePath("/schedule");
  return { ok: true };
}

/** Apply a template onto the week that contains `weekISO` (skips employees no longer active). */
export async function applyTemplate(templateId: string, weekISO: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const tpl = await prisma.scheduleTemplate.findUnique({ where: { id: templateId } });
  if (!tpl || !canAccessLocal(user, tpl.localId)) return { error: "Plantilla no válida." };

  const monday = mondayUTC(new Date(weekISO));
  const shifts = tpl.data as unknown as TemplateShift[];
  const activeIds = new Set(
    (await prisma.employee.findMany({ where: { localId: tpl.localId, deletedAt: null, status: "ACTIVO" }, select: { id: true } })).map((e) => e.id)
  );

  const toCreate = shifts
    .filter((s) => activeIds.has(s.employeeId) && s.weekday >= 0 && s.weekday <= 6)
    .map((s) => {
      const date = new Date(monday); date.setUTCDate(monday.getUTCDate() + s.weekday);
      return { localId: tpl.localId, employeeId: s.employeeId, date, startTime: s.startTime, endTime: s.endTime, note: s.note, published: false, createdById: user.id };
    });
  if (toCreate.length === 0) return { error: "La plantilla no produjo turnos (empleados inactivos)." };

  await prisma.shift.createMany({ data: toCreate });
  await audit({ ...auditContext(user), localId: tpl.localId, action: "schedule.template.apply", entity: "ScheduleTemplate", entityId: templateId, detail: { created: toCreate.length, week: weekISO } });
  revalidatePath("/schedule");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const tpl = await prisma.scheduleTemplate.findUnique({ where: { id } });
  if (!tpl || !canAccessLocal(user, tpl.localId)) throw new Error("Sin permiso.");
  await prisma.scheduleTemplate.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: tpl.localId, action: "schedule.template.delete", entity: "ScheduleTemplate", entityId: id });
  revalidatePath("/schedule");
}
