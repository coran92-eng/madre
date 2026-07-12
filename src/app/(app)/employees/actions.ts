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
