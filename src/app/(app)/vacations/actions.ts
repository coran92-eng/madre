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
  isoWeek,
  isoWeekRange,
  isoWeeksInYear,
  isoWeekDays,
  dateKey,
  approvedKey,
  dayApprovedKey,
  getVacationYear,
  employeeBalance,
} from "@/lib/vacations";

class OverlapError extends Error {
  constructor(public conflictKey: string) {
    super(`Solapamiento en ${conflictKey}`);
  }
}

async function currentEmployee(userId: string) {
  return prisma.employee.findUnique({ where: { userId } });
}

// ── Employee: request weeks ─────────────────────────────────────────────────

export async function requestVacation(
  year: number,
  weeks: number[],
  days: string[] = []
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const employee = await currentEmployee(user.id);
  if (!employee) return { error: "Tu cuenta no está vinculada a una ficha de empleado." };
  if (employee.deletedAt) return { error: "Empleado dado de baja." };

  const cfg = await getVacationYear(employee.localId, year);
  if (!cfg?.requestsOpen) return { error: "Las solicitudes de vacaciones no están abiertas." };

  const max = isoWeeksInYear(year);
  const cleanWeeks = Array.from(new Set(weeks)).filter((w) => Number.isInteger(w) && w >= 1 && w <= max);
  // El rango de fechas del "año ISO" no coincide con el año natural: la
  // semana 1 puede empezar en diciembre del año anterior (p.ej. semana 1 de
  // 2026 arranca el lunes 29 dic 2025) — por eso NO se valida por
  // date.getUTCFullYear(), sino por pertenecer al rango real de semanas 1..max.
  const yearStart = isoWeekRange(year, 1).start;
  const yearEnd = isoWeekRange(year, max).end;
  const cleanDays = Array.from(new Set(days))
    .map((s) => new Date(`${s}T00:00:00.000Z`))
    .filter((d) => !isNaN(d.getTime()) && d >= yearStart && d <= yearEnd);

  if (cleanWeeks.length === 0 && cleanDays.length === 0) return { error: "Selecciona al menos una semana o un día." };

  // No se puede pedir más de lo que queda: saldo aprobado menos lo que ya
  // está pendiente de aprobar en OTRAS solicitudes (si no, dos solicitudes
  // pendientes podrían sumar más que el derecho anual y solo saltar al
  // aprobar la segunda, cuando ya es tarde para reajustar).
  const requestedDays = cleanWeeks.length * 7 + cleanDays.length;
  const balance = await employeeBalance(employee.id, year);
  const available = balance.balanceDays - balance.pendingDays;
  if (requestedDays > available) {
    return {
      error: `Solo tienes ${available} día(s) disponibles y estás pidiendo ${requestedDays}. Ajusta la selección.`,
    };
  }

  // Un día suelto no puede caer dentro de una de las semanas completas ya
  // elegidas en la misma solicitud (sería redundante y complica el cálculo).
  const weekDateKeys = new Set(cleanWeeks.flatMap((w) => isoWeekDays(year, w).map(dateKey)));
  const overlapWithinRequest = cleanDays.find((d) => weekDateKeys.has(dateKey(d)));
  if (overlapWithinRequest) {
    return { error: `El día ${dateKey(overlapWithinRequest)} ya forma parte de una de las semanas seleccionadas.` };
  }

  // Re-validate availability server-side (anti-overlap + blocked).
  const allDates = [...cleanWeeks.flatMap((w) => isoWeekDays(year, w)), ...cleanDays];

  // No se pueden pedir fechas que ya han pasado. "Hoy" se calcula en la zona
  // del negocio (Europe/Madrid), no en UTC del servidor — en serverless el
  // servidor corre en UTC y entre medianoche y la 1-2h española diría que
  // "hoy" aún es ayer.
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const startOfToday = new Date(`${todayKey}T00:00:00.000Z`);
  const pastDate = allDates.find((d) => d < startOfToday);
  if (pastDate) {
    return { error: `El día ${dateKey(pastDate)} ya ha pasado — solo se pueden pedir fechas a partir de hoy.` };
  }

  // Tampoco fechas que el propio empleado ya tenga pedidas o aprobadas en otra
  // solicitud (con una pestaña desactualizada se podría enviar dos veces la
  // misma semana; contra los demás ya protege el anti-solapamiento, pero
  // contra uno mismo las pendientes no cuentan hasta que se aprueban).
  const [ownWeeks, ownDays] = await Promise.all([
    prisma.vacationWeek.findMany({
      where: { year, request: { employeeId: employee.id, status: { in: ["PENDIENTE", "APROBADA"] } } },
      select: { week: true },
    }),
    prisma.vacationDay.findMany({
      where: { date: { in: allDates }, request: { employeeId: employee.id, status: { in: ["PENDIENTE", "APROBADA"] } } },
      select: { date: true },
    }),
  ]);
  const ownDateKeys = new Set([
    ...ownWeeks.flatMap((w) => isoWeekDays(year, w.week).map(dateKey)),
    ...ownDays.map((d) => dateKey(d.date)),
  ]);
  const ownDupe = allDates.map(dateKey).find((k) => ownDateKeys.has(k));
  if (ownDupe) {
    return { error: `Ya tienes el día ${ownDupe} en otra solicitud tuya (pendiente o aprobada).` };
  }
  const [blockedWeeks, takenWeeks, takenDays] = await Promise.all([
    prisma.blockedWeek.findMany({ where: { localId: employee.localId, year } }),
    prisma.vacationWeek.findMany({ where: { localId: employee.localId, year, approvedKey: { not: null } } }),
    prisma.vacationDay.findMany({ where: { localId: employee.localId, year, approvedKey: { not: null }, date: { in: allDates } } }),
  ]);
  const blockedWeekSet = new Set(blockedWeeks.map((b) => b.week));
  for (const w of cleanWeeks) {
    if (blockedWeekSet.has(w)) return { error: `Semana ${w} está bloqueada (temporada alta).` };
  }
  for (const d of cleanDays) {
    if (blockedWeekSet.has(isoWeek(d))) return { error: `El día ${dateKey(d)} cae en una semana bloqueada.` };
  }

  const takenWeekSet = new Set(takenWeeks.map((w) => w.week));
  for (const w of cleanWeeks) {
    if (takenWeekSet.has(w)) return { error: `Semana ${w} ya está ocupada por un compañero.` };
  }
  const takenWeekDateKeys = new Set(takenWeeks.flatMap((w) => isoWeekDays(year, w.week).map(dateKey)));
  const takenDayKeys = new Set(takenDays.map((d) => dateKey(d.date)));
  for (const d of cleanDays) {
    const k = dateKey(d);
    if (takenWeekDateKeys.has(k) || takenDayKeys.has(k)) return { error: `El día ${k} ya está ocupado por un compañero.` };
  }
  for (const w of cleanWeeks) {
    const conflictDay = isoWeekDays(year, w).find((d) => takenDayKeys.has(dateKey(d)));
    if (conflictDay) return { error: `La semana ${w} incluye el día ${dateKey(conflictDay)}, ya ocupado por un compañero.` };
  }

  const request = await prisma.vacationRequest.create({
    data: {
      localId: employee.localId,
      employeeId: employee.id,
      year,
      status: "PENDIENTE",
      weeks: {
        create: cleanWeeks.map((w) => {
          const { start, end } = isoWeekRange(year, w);
          return { localId: employee.localId, year, week: w, startDate: start, endDate: end };
        }),
      },
      days: {
        create: cleanDays.map((date) => ({ localId: employee.localId, year, date })),
      },
    },
  });

  await audit({
    ...auditContext(user),
    localId: employee.localId,
    action: "vacation.request",
    entity: "VacationRequest",
    entityId: request.id,
    detail: { year, weeks: cleanWeeks, days: cleanDays.map(dateKey) },
  });

  // Avisa a quien aprueba (superadmin + encargados del local) — sin esto
  // tendrían que entrar a Aprobaciones por iniciativa propia.
  const approvers = await prisma.user.findMany({
    where: { active: true, OR: [{ role: "SUPERADMIN" }, { role: "ENCARGADO", localId: employee.localId }] },
    select: { email: true },
  });
  const summary = [
    cleanWeeks.length ? `semana${cleanWeeks.length === 1 ? "" : "s"} ${cleanWeeks.join(", ")}` : "",
    cleanDays.length ? `${cleanDays.length} día(s) suelto(s)` : "",
  ].filter(Boolean).join(" + ");
  await Promise.all(
    approvers
      .filter((a) => a.email !== user.email) // si quien pide es también encargado, no se auto-avisa
      .map((a) =>
        notify(
          a.email,
          "Nueva solicitud de vacaciones",
          `${employee.firstName} ${employee.lastName} ha solicitado ${requestedDays} día(s) de vacaciones (${summary}). Pendiente de aprobación.`,
          "/vacations/approvals"
        )
      )
  );

  revalidatePath("/vacations");
  return { ok: true };
}

// Devuelve {error} en vez de lanzar: una excepción en una server action llega
// al error boundary como "Algo ha ido mal" a página completa — para un botón
// inline queremos el motivo junto al botón.
export async function cancelVacation(requestId: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const req = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  if (!req) return { error: "Solicitud no encontrada." };
  const employee = await currentEmployee(user.id);
  const isOwner = employee && req.employeeId === employee.id;
  const isAdmin = user.role === "SUPERADMIN" || user.role === "ENCARGADO";
  if (!isOwner && !isAdmin) return { error: "Sin permiso." };
  if (req.status === "CANCELADA") return { ok: true }; // doble clic: ya está hecho
  if (req.status === "RECHAZADA") return { error: "La solicitud ya fue rechazada." };
  if (req.status === "APROBADA" && !isAdmin) return { error: "Ya está aprobada: pide a tu encargado que la cancele." };
  const wasApproved = req.status === "APROBADA";

  await prisma.$transaction([
    // Free the weeks and days (clears approvedKey so the slots reopen).
    prisma.vacationWeek.updateMany({ where: { requestId }, data: { approvedKey: null } }),
    prisma.vacationDay.updateMany({ where: { requestId }, data: { approvedKey: null } }),
    prisma.vacationRequest.update({ where: { id: requestId }, data: { status: "CANCELADA" } }),
  ]);
  await audit({ ...auditContext(user), localId: req.localId, action: "vacation.cancel", entity: "VacationRequest", entityId: requestId });
  // Si un admin cancela unas vacaciones ya aprobadas, el empleado tiene que enterarse.
  if (wasApproved && !isOwner) {
    const emp = await prisma.employee.findUnique({ where: { id: req.employeeId }, select: { email: true } });
    await notify(emp?.email, "Vacaciones canceladas", "Tus vacaciones aprobadas han sido canceladas por dirección. Habla con tu encargado si tienes dudas.");
  }
  revalidatePath("/vacations");
  revalidatePath("/vacations/approvals");
  return { ok: true };
}

// ── Admin: approve / reject ─────────────────────────────────────────────────

export async function approveVacation(requestId: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const req = await prisma.vacationRequest.findUnique({ where: { id: requestId }, include: { weeks: true, days: true } });
  if (!req) return { error: "No encontrado." };
  if (!canAccessLocal(user, req.localId)) return { error: "Sin permiso." };
  if (req.status !== "PENDIENTE") return { error: "La solicitud no está pendiente." };

  // A blocked week may have been added after the request (weeks, and any
  // loose day whose ISO week is now blocked).
  const blockedWeeks = await prisma.blockedWeek.findMany({ where: { localId: req.localId, year: req.year } });
  const blockedWeekSet = new Set(blockedWeeks.map((b) => b.week));
  const blockedWeekHit = req.weeks.find((w) => blockedWeekSet.has(w.week));
  if (blockedWeekHit) return { error: `No se puede aprobar: la semana ${blockedWeekHit.week} está bloqueada.` };
  const blockedDayHit = req.days.find((d) => blockedWeekSet.has(isoWeek(d.date)));
  if (blockedDayHit) return { error: `No se puede aprobar: el día ${dateKey(blockedDayHit.date)} cae en una semana bloqueada.` };

  try {
    // Serializable: el cruce semana-aprobada-de-otro vs. día-suelto-de-esta-
    // solicitud (y viceversa) se comprueba leyendo otras filas dentro de la
    // transacción — sin aislamiento serializable, dos aprobaciones concurrentes
    // que se solapan a nivel semana/día (no vía el mismo índice único) podrían
    // colarse las dos. Postgres aborta una de las dos con error de
    // serialización, que se captura abajo como conflicto.
    await prisma.$transaction(
      async (tx) => {
        const allDates = [...req.weeks.flatMap((w) => isoWeekDays(req.year, w.week)), ...req.days.map((d) => d.date)];

        // Días de ESTA solicitud que ya estén aprobados como día suelto en OTRA solicitud.
        const conflictingDay = allDates.length
          ? await tx.vacationDay.findFirst({
              where: { localId: req.localId, requestId: { not: req.id }, approvedKey: { not: null }, date: { in: allDates } },
            })
          : null;
        if (conflictingDay) throw new OverlapError(dateKey(conflictingDay.date));

        // Días de ESTA solicitud que ya estén cubiertos por una SEMANA aprobada de otra solicitud.
        const approvedWeeksElsewhere = await tx.vacationWeek.findMany({
          where: { localId: req.localId, year: req.year, requestId: { not: req.id }, approvedKey: { not: null } },
          select: { week: true },
        });
        const approvedWeekDateKeys = new Set(approvedWeeksElsewhere.flatMap((w) => isoWeekDays(req.year, w.week).map(dateKey)));
        const dateKeyHit = allDates.map(dateKey).find((k) => approvedWeekDateKeys.has(k));
        if (dateKeyHit) throw new OverlapError(dateKeyHit);

        // Setting approvedKey (unique) enforces the ABSOLUTE anti-overlap rule at
        // the database level for same-granularity conflicts (semana vs. semana,
        // día vs. día). A concurrent approval of the exact same slot fails here.
        for (const w of req.weeks) {
          await tx.vacationWeek.update({ where: { id: w.id }, data: { approvedKey: approvedKey(req.localId, req.year, w.week) } });
        }
        for (const d of req.days) {
          await tx.vacationDay.update({ where: { id: d.id }, data: { approvedKey: dayApprovedKey(req.localId, d.date) } });
        }
        await tx.vacationRequest.update({
          where: { id: requestId },
          data: { status: "APROBADA", decidedById: user.id, decidedAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof OverlapError) {
      return { error: `Conflicto: el día ${err.conflictKey} ya está ocupado por un compañero.` };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2034")) {
      return { error: "Conflicto: alguna de esas fechas acaba de ser ocupada por otro compañero." };
    }
    throw err;
  }

  const daysLabel = req.days.length ? ` y ${req.days.length} día(s) suelto(s)` : "";
  await audit({
    ...auditContext(user),
    localId: req.localId,
    action: "vacation.approve",
    entity: "VacationRequest",
    entityId: requestId,
    detail: { weeks: req.weeks.map((w) => w.week), days: req.days.map((d) => dateKey(d.date)) },
  });
  const emp = await prisma.employee.findUnique({ where: { id: req.employeeId }, select: { email: true } });
  await notify(
    emp?.email,
    "Vacaciones aprobadas",
    `Se han aprobado tus vacaciones${req.weeks.length ? ` (semanas ${req.weeks.map((w) => w.week).join(", ")})` : ""}${daysLabel}.`
  );
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
    prisma.vacationDay.updateMany({ where: { requestId }, data: { approvedKey: null } }),
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
