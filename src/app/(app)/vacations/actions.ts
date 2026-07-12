"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import {
  isoWeekRange,
  isoWeeksInYear,
  approvedKey,
  getVacationYear,
} from "@/lib/vacations";

async function currentEmployee(userId: string) {
  return prisma.employee.findUnique({ where: { userId } });
}

// ── Employee: request weeks ─────────────────────────────────────────────────

export async function requestVacation(
  year: number,
  weeks: number[]
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const employee = await currentEmployee(user.id);
  if (!employee) return { error: "Tu cuenta no está vinculada a una ficha de empleado." };
  if (employee.deletedAt) return { error: "Empleado dado de baja." };

  const cfg = await getVacationYear(employee.localId, year);
  if (!cfg?.requestsOpen) return { error: "Las solicitudes de vacaciones no están abiertas." };

  const max = isoWeeksInYear(year);
  const clean = Array.from(new Set(weeks)).filter((w) => Number.isInteger(w) && w >= 1 && w <= max);
  if (clean.length === 0) return { error: "Selecciona al menos una semana." };

  // Re-validate availability server-side (anti-overlap + blocked).
  const [blocked, taken] = await Promise.all([
    prisma.blockedWeek.findMany({ where: { localId: employee.localId, year, week: { in: clean } } }),
    prisma.vacationWeek.findMany({
      where: { localId: employee.localId, year, week: { in: clean }, approvedKey: { not: null } },
    }),
  ]);
  if (blocked.length) return { error: `Semana ${blocked[0].week} está bloqueada (temporada alta).` };
  if (taken.length) return { error: `Semana ${taken[0].week} ya está ocupada por un compañero.` };

  const request = await prisma.vacationRequest.create({
    data: {
      localId: employee.localId,
      employeeId: employee.id,
      year,
      status: "PENDIENTE",
      weeks: {
        create: clean.map((w) => {
          const { start, end } = isoWeekRange(year, w);
          return { localId: employee.localId, year, week: w, startDate: start, endDate: end };
        }),
      },
    },
  });

  await audit({
    ...auditContext(user),
    localId: employee.localId,
    action: "vacation.request",
    entity: "VacationRequest",
    entityId: request.id,
    detail: { year, weeks: clean },
  });
  revalidatePath("/vacations");
  return { ok: true };
}

export async function cancelVacation(requestId: string): Promise<void> {
  const user = await requireUser();
  const req = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error("No encontrado.");
  const employee = await currentEmployee(user.id);
  const isOwner = employee && req.employeeId === employee.id;
  const isAdmin = user.role === "SUPERADMIN" || user.role === "ENCARGADO";
  if (!isOwner && !isAdmin) throw new Error("Sin permiso.");
  if (req.status === "APROBADA" && !isAdmin) throw new Error("Ya aprobada: contacta con tu encargado.");

  await prisma.$transaction([
    // Free the weeks (clears approvedKey so the slot reopens).
    prisma.vacationWeek.updateMany({ where: { requestId }, data: { approvedKey: null } }),
    prisma.vacationRequest.update({ where: { id: requestId }, data: { status: "CANCELADA" } }),
  ]);
  await audit({ ...auditContext(user), localId: req.localId, action: "vacation.cancel", entity: "VacationRequest", entityId: requestId });
  revalidatePath("/vacations");
  revalidatePath("/vacations/approvals");
}

// ── Admin: approve / reject ─────────────────────────────────────────────────

export async function approveVacation(requestId: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const req = await prisma.vacationRequest.findUnique({ where: { id: requestId }, include: { weeks: true } });
  if (!req) return { error: "No encontrado." };
  if (!canAccessLocal(user, req.localId)) return { error: "Sin permiso." };
  if (req.status !== "PENDIENTE") return { error: "La solicitud no está pendiente." };

  // A blocked week may have been added after the request.
  const blocked = await prisma.blockedWeek.findFirst({
    where: { localId: req.localId, year: req.year, week: { in: req.weeks.map((w) => w.week) } },
  });
  if (blocked) return { error: `No se puede aprobar: la semana ${blocked.week} está bloqueada.` };

  try {
    await prisma.$transaction(async (tx) => {
      // Setting approvedKey (unique) is what enforces the ABSOLUTE anti-overlap
      // rule at the database level. A concurrent approval of the same week fails here.
      for (const w of req.weeks) {
        await tx.vacationWeek.update({
          where: { id: w.id },
          data: { approvedKey: approvedKey(req.localId, req.year, w.week) },
        });
      }
      await tx.vacationRequest.update({
        where: { id: requestId },
        data: { status: "APROBADA", decidedById: user.id, decidedAt: new Date() },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Conflicto: alguna de esas semanas acaba de ser ocupada por otro compañero." };
    }
    throw err;
  }

  await audit({ ...auditContext(user), localId: req.localId, action: "vacation.approve", entity: "VacationRequest", entityId: requestId, detail: { weeks: req.weeks.map((w) => w.week) } });
  const emp = await prisma.employee.findUnique({ where: { id: req.employeeId }, select: { email: true } });
  await notify(emp?.email, "Vacaciones aprobadas", `Se han aprobado tus vacaciones (semanas ${req.weeks.map((w) => w.week).join(", ")}).`);
  revalidatePath("/vacations");
  revalidatePath("/vacations/approvals");
  return { ok: true };
}

export async function rejectVacation(requestId: string, note: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const req = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  if (!req) return { error: "No encontrado." };
  if (!canAccessLocal(user, req.localId)) return { error: "Sin permiso." };
  if (req.status !== "PENDIENTE") return { error: "La solicitud no está pendiente." };

  await prisma.$transaction([
    prisma.vacationWeek.updateMany({ where: { requestId }, data: { approvedKey: null } }),
    prisma.vacationRequest.update({
      where: { id: requestId },
      data: { status: "RECHAZADA", decisionNote: note || null, decidedById: user.id, decidedAt: new Date() },
    }),
  ]);
  await audit({ ...auditContext(user), localId: req.localId, action: "vacation.reject", entity: "VacationRequest", entityId: requestId, detail: { note } });
  const emp = await prisma.employee.findUnique({ where: { id: req.employeeId }, select: { email: true } });
  await notify(emp?.email, "Vacaciones rechazadas", `Tu solicitud de vacaciones ha sido rechazada.${note ? ` Motivo: ${note}` : ""}`);
  revalidatePath("/vacations/approvals");
  return { ok: true };
}

// ── Employee: bolsa de días (manual adjustments) ────────────────────────────

const adjSchema = z.object({
  year: z.coerce.number().int(),
  days: z.coerce.number().refine((n) => n !== 0, "Indica los días"),
  reason: z.string().min(2, "Indica el motivo"),
  desiredDate: z.string().optional(),
});

export async function requestAdjustment(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const employee = await currentEmployee(user.id);
  if (!employee) return { error: "Sin ficha de empleado." };
  const parsed = adjSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const adj = await prisma.vacationAdjustment.create({
    data: {
      localId: employee.localId,
      employeeId: employee.id,
      year: d.year,
      days: d.days,
      reason: d.reason,
      desiredDate: d.desiredDate ? new Date(d.desiredDate + "T00:00:00Z") : null,
    },
  });
  await audit({ ...auditContext(user), localId: employee.localId, action: "vacation.adjustment.request", entity: "VacationAdjustment", entityId: adj.id, detail: { days: d.days } });
  revalidatePath("/vacations");
  return { ok: true };
}

export async function decideAdjustment(id: string, approve: boolean): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const adj = await prisma.vacationAdjustment.findUnique({ where: { id } });
  if (!adj || !canAccessLocal(user, adj.localId)) throw new Error("Sin permiso.");
  await prisma.vacationAdjustment.update({
    where: { id },
    data: { status: approve ? "APROBADA" : "RECHAZADA", decidedById: user.id, decidedAt: new Date() },
  });
  await audit({ ...auditContext(user), localId: adj.localId, action: approve ? "vacation.adjustment.approve" : "vacation.adjustment.reject", entity: "VacationAdjustment", entityId: id });
  revalidatePath("/vacations/approvals");
}

// ── Admin: year config + blocked weeks ──────────────────────────────────────

const yearSchema = z.object({
  localId: z.string().min(1),
  year: z.coerce.number().int().min(2024).max(2100),
  daysPerEmployee: z.coerce.number().int().min(1).max(60),
  weeksPerEmployee: z.coerce.number().int().min(1).max(12),
  accrualPerMonth: z.coerce.number().min(0).max(10),
  priorityRule: z.enum(["ORDEN_SOLICITUD", "ANTIGUEDAD", "ROTACION"]),
});

export async function saveVacationYear(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = yearSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (!canAccessLocal(user, d.localId)) return { error: "Sin permiso." };

  await prisma.vacationYear.upsert({
    where: { localId_year: { localId: d.localId, year: d.year } },
    create: { ...d },
    update: {
      daysPerEmployee: d.daysPerEmployee,
      weeksPerEmployee: d.weeksPerEmployee,
      accrualPerMonth: d.accrualPerMonth,
      priorityRule: d.priorityRule,
    },
  });
  await audit({ ...auditContext(user), localId: d.localId, action: "vacation.year.save", entity: "VacationYear", detail: { year: d.year } });
  revalidatePath("/vacations/config");
  return { ok: true };
}

export async function toggleRequests(localId: string, year: number, open: boolean): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  if (!canAccessLocal(user, localId)) throw new Error("Sin permiso.");
  await prisma.vacationYear.update({
    where: { localId_year: { localId, year } },
    data: { requestsOpen: open },
  });
  await audit({ ...auditContext(user), localId, action: open ? "vacation.requests.open" : "vacation.requests.close", entity: "VacationYear", detail: { year } });
  revalidatePath("/vacations/config");
}

export async function addBlockedWeek(localId: string, year: number, week: number, reason: string): Promise<{ error?: string }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  if (!canAccessLocal(user, localId)) return { error: "Sin permiso." };
  if (week < 1 || week > isoWeeksInYear(year)) return { error: "Semana no válida." };
  try {
    await prisma.blockedWeek.create({ data: { localId, year, week, reason: reason || null } });
  } catch {
    return { error: "Esa semana ya está bloqueada." };
  }
  await audit({ ...auditContext(user), localId, action: "vacation.blockedweek.add", entity: "BlockedWeek", detail: { year, week } });
  revalidatePath("/vacations/config");
  return {};
}

export async function removeBlockedWeek(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const bw = await prisma.blockedWeek.findUnique({ where: { id } });
  if (!bw || !canAccessLocal(user, bw.localId)) throw new Error("Sin permiso.");
  await prisma.blockedWeek.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: bw.localId, action: "vacation.blockedweek.remove", entity: "BlockedWeek", detail: { year: bw.year, week: bw.week } });
  revalidatePath("/vacations/config");
}
