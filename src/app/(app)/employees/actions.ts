"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext, hashPassword, generatePassword } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const employeeSchema = z.object({
  localId: z.string().min(1),
  firstName: z.string().min(1, "Nombre requerido"),
  lastName: z.string().min(1, "Apellidos requeridos"),
  nif: z.string().optional(),
  ssNumber: z.string().optional(),
  iban: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  contractType: z.enum(["INDEFINIDO", "TEMPORAL", "FIJO_DISCONTINUO", "FORMACION", "PRACTICAS"]),
  weeklyHours: z.coerce.number().min(0).max(60),
  startDate: z.string().min(1, "Fecha de alta requerida"),
  endDate: z.string().optional(),
  trialEndDate: z.string().optional(),
  status: z.enum(["ACTIVO", "BAJA", "EXCEDENCIA"]),
  vacationDaysOverride: z.string().optional(),
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

  await prisma.employee.update({
    where: { id },
    data: {
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
    },
  });

  await audit({
    ...auditContext(user),
    localId: current.localId,
    action: "employee.update",
    entity: "Employee",
    entityId: id,
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
 * display to the admin (never stored in plaintext).
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
