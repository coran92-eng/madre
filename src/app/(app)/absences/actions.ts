"use server";

import { randomUUID } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { saveFile } from "@/lib/storage";
import { notify } from "@/lib/notify";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);

const schema = z.object({
  type: z.enum(["BAJA_MEDICA", "MATRIMONIO", "MUDANZA", "FALLECIMIENTO", "NACIMIENTO", "DEBER_PUBLICO", "LACTANCIA", "OTRO"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
});

export async function requestAbsence(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee || employee.deletedAt) return { error: "Tu cuenta no está vinculada a una ficha de empleado." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  const start = new Date(d.startDate + "T00:00:00Z");
  const end = new Date(d.endDate + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: "Fechas no válidas." };
  if (end < start) return { error: "La fecha de fin no puede ser anterior al inicio." };

  // Optional justificante.
  let justFileName: string | null = null;
  let justStorageKey: string | null = null;
  let justMimeType: string | null = null;
  const file = formData.get("justificante");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: "El justificante supera 12 MB." };
    if (!ALLOWED.has(file.type)) return { error: "Justificante: solo PDF, PNG o JPG." };
    const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : "");
    justStorageKey = `${employee.localId}/${employee.id}/absence-${randomUUID()}${ext}`;
    await saveFile(justStorageKey, Buffer.from(await file.arrayBuffer()));
    justFileName = file.name;
    justMimeType = file.type;
  }

  const abs = await prisma.absence.create({
    data: {
      localId: employee.localId,
      employeeId: employee.id,
      type: d.type,
      startDate: start,
      endDate: end,
      reason: d.reason || null,
      justFileName,
      justStorageKey,
      justMimeType,
    },
  });
  await audit({ ...auditContext(user), localId: employee.localId, action: "absence.request", entity: "Absence", entityId: abs.id, detail: { type: d.type } });
  revalidatePath("/absences");
  return { ok: true };
}

export async function decideAbsence(id: string, approve: boolean, note: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const abs = await prisma.absence.findUnique({ where: { id } });
  if (!abs || !canAccessLocal(user, abs.localId)) return { error: "Sin permiso." };
  if (abs.status !== "PENDIENTE") return { error: "La solicitud no está pendiente." };

  await prisma.absence.update({
    where: { id },
    data: { status: approve ? "APROBADA" : "RECHAZADA", decisionNote: note || null, decidedById: user.id, decidedAt: new Date() },
  });
  await audit({ ...auditContext(user), localId: abs.localId, action: approve ? "absence.approve" : "absence.reject", entity: "Absence", entityId: id });
  const emp = await prisma.employee.findUnique({ where: { id: abs.employeeId }, select: { email: true } });
  await notify(emp?.email, approve ? "Ausencia aprobada" : "Ausencia rechazada", approve ? "Tu solicitud de ausencia/permiso ha sido aprobada." : `Tu solicitud de ausencia ha sido rechazada.${note ? ` Motivo: ${note}` : ""}`);
  revalidatePath("/absences");
  return { ok: true };
}

export async function cancelAbsence(id: string): Promise<void> {
  const user = await requireUser();
  const abs = await prisma.absence.findUnique({ where: { id } });
  if (!abs) throw new Error("No encontrado.");
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  const isOwner = employee && abs.employeeId === employee.id;
  const isAdmin = user.role === "SUPERADMIN" || user.role === "ENCARGADO";
  if (!isOwner && !isAdmin) throw new Error("Sin permiso.");
  await prisma.absence.update({ where: { id }, data: { status: "CANCELADA" } });
  await audit({ ...auditContext(user), localId: abs.localId, action: "absence.cancel", entity: "Absence", entityId: id });
  revalidatePath("/absences");
}
