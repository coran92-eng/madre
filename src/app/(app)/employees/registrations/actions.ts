"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext, hashPassword, generatePassword } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const INVITE_DAYS = 7;

function hostBase(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Genera un enlace de un solo uso y lo envía por email al futuro empleado. */
export async function createInvite(localId: string, email: string): Promise<{ error?: string; ok?: boolean; url?: string }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  if (!canAccessLocal(user, localId)) return { error: "Sin permiso sobre ese local." };
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { error: "Email no válido." };

  const token = randomBytes(32).toString("hex");
  const reg = await prisma.employeeRegistration.create({
    data: {
      localId,
      email: parsed.data.toLowerCase(),
      token,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86400000),
      createdById: user.id,
    },
  });

  const url = `${hostBase()}/join/${token}`;
  await notify(
    reg.email,
    "Alta en MADRE",
    `Hola,\n\nTe han invitado a completar tu alta como empleado en MADRE.\n\nRellena tus datos aquí (enlace válido ${INVITE_DAYS} días):\n${url}\n\nUn responsable revisará y aprobará tu solicitud antes de darte acceso.`,
    url
  );

  await audit({ ...auditContext(user), localId, action: "registration.invite", entity: "EmployeeRegistration", entityId: reg.id, detail: { email: reg.email } });
  revalidatePath("/employees/registrations");
  return { ok: true, url };
}

/** Crea la ficha + acceso a partir de una solicitud ya completada por el empleado, y le envía la contraseña. */
export async function approveRegistration(id: string): Promise<{ error?: string; ok?: boolean; password?: string; email?: string }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const reg = await prisma.employeeRegistration.findUnique({ where: { id } });
  if (!reg) return { error: "No encontrada." };
  if (!canAccessLocal(user, reg.localId)) return { error: "Sin permiso." };
  if (reg.status !== "PENDIENTE") return { error: "Ya se ha decidido esta solicitud." };
  if (!reg.submittedAt || !reg.firstName || !reg.lastName || !reg.startDate) {
    return { error: "El empleado aún no ha completado el formulario." };
  }

  const exists = await prisma.user.findUnique({ where: { email: reg.email } });
  if (exists) return { error: "Ese email ya está en uso por otra cuenta." };

  const tempPassword = generatePassword();
  const { employee } = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        localId: reg.localId,
        firstName: reg.firstName!,
        lastName: reg.lastName!,
        nif: reg.nif,
        ssNumber: reg.ssNumber,
        iban: reg.iban,
        phone: reg.phone,
        email: reg.email,
        emergencyContact: reg.emergencyContact,
        emergencyPhone: reg.emergencyPhone,
        contractType: reg.contractType ?? "INDEFINIDO",
        weeklyHours: reg.weeklyHours ?? 40,
        startDate: reg.startDate!,
      },
    });
    const createdUser = await tx.user.create({
      data: {
        email: reg.email,
        passwordHash: await hashPassword(tempPassword),
        role: "EMPLEADO",
        localId: reg.localId,
        mustChangePassword: true,
        employee: { connect: { id: employee.id } },
      },
    });
    await tx.employeeRegistration.update({
      where: { id },
      data: { status: "APROBADA", decidedById: user.id, decidedAt: new Date(), createdEmployeeId: employee.id },
    });
    return { employee, createdUser };
  });

  const loginUrl = `${hostBase()}/login`;
  await notify(
    reg.email,
    "Acceso a MADRE",
    `Hola ${reg.firstName},\n\nTu alta ha sido aprobada. Ya tienes acceso a MADRE.\n\nEmail: ${reg.email}\nContraseña temporal: ${tempPassword}\n\nEntra en ${loginUrl} y te pedirá cambiarla en el primer acceso.`,
    loginUrl
  );

  await audit({ ...auditContext(user), localId: reg.localId, action: "registration.approve", entity: "Employee", entityId: employee.id, detail: { registrationId: id } });
  revalidatePath("/employees/registrations");
  revalidatePath("/employees");
  return { ok: true, password: tempPassword, email: reg.email };
}

export async function rejectRegistration(id: string, note: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const reg = await prisma.employeeRegistration.findUnique({ where: { id } });
  if (!reg) return { error: "No encontrada." };
  if (!canAccessLocal(user, reg.localId)) return { error: "Sin permiso." };
  if (reg.status !== "PENDIENTE") return { error: "Ya se ha decidido esta solicitud." };

  await prisma.employeeRegistration.update({
    where: { id },
    data: { status: "RECHAZADA", decidedById: user.id, decidedAt: new Date(), rejectionNote: note || null },
  });
  await audit({ ...auditContext(user), localId: reg.localId, action: "registration.reject", entity: "EmployeeRegistration", entityId: id, detail: { note } });
  if (reg.submittedAt) {
    await notify(reg.email, "Solicitud de alta no aceptada", `Tu solicitud de alta no ha sido aceptada.${note ? ` Motivo: ${note}` : ""}`);
  }
  revalidatePath("/employees/registrations");
  return { ok: true };
}
