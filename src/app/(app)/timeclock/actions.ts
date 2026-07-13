"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const schema = z.object({
  entryId: z.string().min(1),
  field: z.enum(["clockIn", "clockOut"]),
  newValue: z.string().min(1),
  reason: z.string().min(3, "Indica el motivo de la corrección"),
});

/**
 * Correct a time entry. The record is never edited silently: every change is
 * appended to TimeCorrection with the previous value, reason and author
 * (spec §4.4 legal requirement).
 */
export async function correctEntry(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const entry = await prisma.timeEntry.findUnique({ where: { id: d.entryId } });
  if (!entry || !canAccessLocal(user, entry.localId)) return { error: "Fichaje no encontrado." };

  const newDate = new Date(d.newValue);
  if (isNaN(newDate.getTime())) return { error: "Fecha/hora no válida." };

  const oldValue = d.field === "clockIn" ? entry.clockIn : entry.clockOut;
  const clockIn = d.field === "clockIn" ? newDate : entry.clockIn;
  const clockOut = d.field === "clockOut" ? newDate : entry.clockOut;
  if (clockOut && clockOut < clockIn) return { error: "La salida no puede ser anterior a la entrada." };

  await prisma.$transaction([
    prisma.timeCorrection.create({
      data: {
        timeEntryId: entry.id,
        field: d.field,
        oldValue,
        newValue: newDate,
        reason: d.reason,
        authorId: user.id,
        authorEmail: user.email,
      },
    }),
    prisma.timeEntry.update({
      where: { id: entry.id },
      data: d.field === "clockIn" ? { clockIn: newDate } : { clockOut: newDate },
    }),
  ]);

  await audit({ ...auditContext(user), localId: entry.localId, action: "timeclock.correct", entity: "TimeEntry", entityId: entry.id, detail: { field: d.field, reason: d.reason } });
  revalidatePath("/timeclock");
  return { ok: true };
}
