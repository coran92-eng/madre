"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext, hashPassword, generatePassword } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const employeeSchema = z.object({
  localId: z.string().min(1),
  firstName: z.string().min(1, "Nombre requerido"),
  lastName: z.string().min(1, "Apellidos requeridos"),
  nif: z.string().optional(),
  ssNumber: z.string().optional(),
  iban: z.string().optional(),
  phone: z.string().min(1, "Teléfono requerido"),
  email: z.string().email("Email no válido"),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  contractType: z.enum(["INDEFINIDO", "TEMPORAL", "FIJO_DISCONTINUO", "FORMACION", "PRACTICAS"]),
  weeklyHours: z.coerce.number().min(0).max(60),
  startDate: z.string().min(1, "Fecha de alta requerida"),
  endDate: z.string().optional(),
  trialEndDate: z.string().optional(),
  status: z.enum(["ACTIVO", "BAJA", "EXCEDENCIA"]),
  vacationDaysOverride: z.string().optional(),
  hourlyCostOverride: z.string().optional(),
});

function toDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00.000Z");
  return isNaN(d.getTime()) ? null : d;
}

export type FormResult = { error?: string; ok?: boolean };

export async function createEmployee(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  if (!canAccessLocal(user, d.localId)) return { error: "Sin permiso sobre ese local." };
  const start = toDate(d.startDate);
  if (!start) return { error: "Fecha de alta no válida." };

  const employee = await prisma.employee.create({
    data: {
      localId: d.localId,
      firstName: d.firstName,
      lastName: d.lastName,
      nif: d.nif || null,
      ssNumber: d.ssNumber || null,
      iban: d.iban || null,
      phone: d.phone || null,
      email: d.email || null,
      emergencyContact: d.emergencyContact || null,
      emergencyPhone: d.emergencyPhone || null,
      contractType: d.contractType,
      weeklyHours: d.weeklyHours,
      startDate: start,
      endDate: toDate(d.endDate),
      trialEndDate: toDate(d.trialEndDate),
      status: d.status,
      vacationDaysOverride: d.vacationDaysOverride ? Number(d.vacationDaysOverride) : null,
      hourlyCostOverride: d.hourlyCostOverride ? Number(d.hourlyCostOverride) : null,
    },
  });

  await audit({
    ...auditContext(user),
    localId: d.localId,
    action: "employee.create",
    entity: "Employee",
    entityId: employee.id,
    detail: { name: `${d.firstName} ${d.lastName}` },
  });

  redirect(`/employees/${employee.id}`);
}

export async function updateEmployee(id: string, _prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const current = await prisma.employee.findUnique({ where: { id } });
  if (!current) return { error: "Empleado no encontrado." };
  if (!canAccessLocal(user, current.localId)) return { error: "Sin permiso." };

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  const start = toDate(d.startDate);
  if (!start) return { error: "Fecha de alta no válida." };

  // Traslado entre centros: solo superadmin. El histórico (fichajes, vacaciones,
  // documentos…) conserva el localId original — el traslado afecta a partir de ahora.
  let newLocalId = current.localId;
  if (d.localId !== current.localId) {
    if (user.role !== "SUPERADMIN") return { error: "Solo el superadmin puede trasladar empleados de centro." };
    const target = await prisma.local.findUnique({ where: { id: d.localId } });
    if (!target || !target.active) return { error: "Local de destino no válido." };
    newLocalId = target.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: {
        localId: newLocalId,
        firstName: d.firstName,
        lastName: d.lastName,
        nif: d.nif || null,
        ssNumber: d.ssNumber || null,
        iban: d.iban || null,
        phone: d.phone || null,
        email: d.email || null,
        emergencyContact: d.emergencyContact || null,
        emergencyPhone: d.emergencyPhone || null,
        contractType: d.contractType,
        weeklyHours: d.weeklyHours,
        startDate: start,
        endDate: toDate(d.endDate),
        trialEndDate: toDate(d.trialEndDate),
        status: d.status,
        vacationDaysOverride: d.vacationDaysOverride ? Number(d.vacationDaysOverride) : null,
        hourlyCostOverride: d.hourlyCostOverride ? Number(d.hourlyCostOverride) : null,
      },
    });
    // La cuenta de acceso sigue al empleado a su nuevo centro.
    if (newLocalId !== current.localId && current.userId) {
      await tx.user.update({ where: { id: current.userId }, data: { localId: newLocalId } });
    }
  });

  await audit({
    ...auditContext(user),
    localId: newLocalId,
    action: newLocalId !== current.localId ? "employee.transfer" : "employee.update",
    entity: "Employee",
    entityId: id,
    detail: newLocalId !== current.localId ? { from: current.localId, to: newLocalId } : undefined,
  });
  revalidatePath(`/employees/${id}`);
  return { ok: true };
}

/** Soft delete (baja) — the record and its history are kept (spec §4.1). */
export async function deactivateEmployee(id: string) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp || !canAccessLocal(user, emp.localId)) throw new Error("Sin permiso.");

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id }, data: { deletedAt: new Date(), status: "BAJA" } });
    // Revoke access but keep the user row for the audit trail.
    if (emp.userId) {
      await tx.user.update({ where: { id: emp.userId }, data: { active: false } });
      await tx.session.deleteMany({ where: { userId: emp.userId } });
    }
  });

  await audit({ ...auditContext(user), localId: emp.localId, action: "employee.deactivate", entity: "Employee", entityId: id });
  revalidatePath("/employees");
  redirect("/employees");
}

export async function reactivateEmployee(id: string) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp || !canAccessLocal(user, emp.localId)) throw new Error("Sin permiso.");
  await prisma.employee.update({ where: { id }, data: { deletedAt: null, status: "ACTIVO" } });
  if (emp.userId) await prisma.user.update({ where: { id: emp.userId }, data: { active: true } });
  await audit({ ...auditContext(user), localId: emp.localId, action: "employee.reactivate", entity: "Employee", entityId: id });
  revalidatePath(`/employees/${id}`);
}

/**
 * Provision a login for an employee. Returns a one-time temporary password to
 * display to the admin (never stored in plaintext) — el admin se la entrega
 * en persona. No se envía por email (spec: simplificar mientras el envío de
 * email no esté verificado en producción).
 */
export async function provisionAccess(id: string, role: "EMPLEADO" | "ENCARGADO"): Promise<{ error?: string; password?: string; email?: string }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp || !canAccessLocal(user, emp.localId)) return { error: "Sin permiso." };
  if (emp.userId) return { error: "Este empleado ya tiene acceso." };
  if (!emp.email) return { error: "Añade un email al empleado antes de dar acceso." };
  // Encargado cannot mint another encargado.
  if (role === "ENCARGADO" && user.role !== "SUPERADMIN") return { error: "Solo el superadmin crea encargados." };

  const exists = await prisma.user.findUnique({ where: { email: emp.email.toLowerCase() } });
  if (exists) return { error: "Ese email ya está en uso por otra cuenta." };

  const tempPassword = generatePassword();
  const created = await prisma.user.create({
    data: {
      email: emp.email.toLowerCase(),
      passwordHash: await hashPassword(tempPassword),
      role,
      localId: emp.localId,
      mustChangePassword: true,
      employee: { connect: { id: emp.id } },
    },
  });

  await audit({ ...auditContext(user), localId: emp.localId, action: "employee.provision_access", entity: "User", entityId: created.id, detail: { role } });

  revalidatePath(`/employees/${id}`);
  return { password: tempPassword, email: emp.email };
}

/** Set/replace an employee's tablet clock-in PIN (hashed). Admin only. */
export async function setClockPin(id: string, pin: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp || !canAccessLocal(user, emp.localId)) return { error: "Sin permiso." };
  if (!/^\d{4,6}$/.test(pin)) return { error: "El PIN debe tener 4-6 dígitos." };
  await prisma.employee.update({ where: { id }, data: { pinHash: await hashPassword(pin) } });
  await audit({ ...auditContext(user), localId: emp.localId, action: "employee.set_pin", entity: "Employee", entityId: id });
  revalidatePath(`/employees/${id}`);
  return { ok: true };
}

/** Add an expiry/caducidad entry for an employee (spec §4.9). */
export async function addExpiry(
  id: string,
  type: string,
  dueDate: string,
  label: string
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp || !canAccessLocal(user, emp.localId)) return { error: "Sin permiso." };
  const types = ["CARNET_MANIPULADOR", "FORMACION_ALERGENOS", "NIE", "DNI", "CONTRATO_TEMPORAL", "PERIODO_PRUEBA", "OTRO"];
  if (!types.includes(type)) return { error: "Tipo no válido." };
  const due = new Date(dueDate + "T00:00:00Z");
  if (isNaN(due.getTime())) return { error: "Fecha no válida." };
  const exp = await prisma.expiry.create({
    data: { localId: emp.localId, employeeId: id, type: type as never, dueDate: due, label: label || null, createdById: user.id },
  });
  await audit({ ...auditContext(user), localId: emp.localId, action: "expiry.add", entity: "Expiry", entityId: exp.id, detail: { type } });
  revalidatePath(`/employees/${id}`);
  revalidatePath("/alerts");
  return { ok: true };
}

export async function resolveExpiry(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const exp = await prisma.expiry.findUnique({ where: { id } });
  if (!exp || !canAccessLocal(user, exp.localId)) throw new Error("Sin permiso.");
  await prisma.expiry.update({ where: { id }, data: { resolved: true } });
  await audit({ ...auditContext(user), localId: exp.localId, action: "expiry.resolve", entity: "Expiry", entityId: id });
  revalidatePath("/alerts");
  revalidatePath(`/employees/${exp.employeeId}`);
}

/**
 * ARCO / retención (§5): borrado DEFINITIVO de un exempleado y todos sus datos,
 * incluidos los archivos. Solo superadmin y solo sobre empleados ya dados de
 * baja (para evitar borrados accidentales de personal activo). Irreversible.
 */
export async function purgeEmployee(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN");
  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      documents: { select: { storageKey: true } },
      incidents: { select: { storageKey: true } },
      absences: { select: { justStorageKey: true } },
    },
  });
  if (!emp) throw new Error("Empleado no encontrado.");
  if (!emp.deletedAt) throw new Error("Da de baja al empleado antes de borrarlo definitivamente.");

  // Remove stored files first (best-effort).
  const keys = [
    ...emp.documents.map((d) => d.storageKey),
    ...emp.incidents.map((i) => i.storageKey),
    ...emp.absences.map((a) => a.justStorageKey),
  ].filter((k): k is string => !!k);
  for (const k of keys) await deleteFile(k);

  await prisma.$transaction(async (tx) => {
    await tx.vacationAdjustment.deleteMany({ where: { employeeId: id } });
    await tx.vacationRequest.deleteMany({ where: { employeeId: id } }); // cascades weeks
    await tx.shift.deleteMany({ where: { employeeId: id } });
    await tx.documentAck.deleteMany({ where: { employeeId: id } });
    await tx.document.deleteMany({ where: { employeeId: id } });
    await tx.timeEntry.deleteMany({ where: { employeeId: id } }); // cascades corrections
    await tx.absence.deleteMany({ where: { employeeId: id } });
    await tx.incident.deleteMany({ where: { employeeId: id } });
    await tx.expiry.deleteMany({ where: { employeeId: id } });
    await tx.manualRead.deleteMany({ where: { employeeId: id } });
    await tx.announcementRead.deleteMany({ where: { employeeId: id } });
    await tx.shiftSwap.deleteMany({ where: { OR: [{ requestedById: id }, { targetEmployeeId: id }] } });
    const userId = emp.userId;
    await tx.employee.delete({ where: { id } });
    if (userId) {
      await tx.session.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    }
  });

  await audit({ ...auditContext(user), localId: emp.localId, action: "arco.purge", entity: "Employee", entityId: id, detail: { name: `${emp.firstName} ${emp.lastName}`, files: keys.length } });
  revalidatePath("/employees");
  redirect("/employees");
}
