"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const schema = z.object({
  localId: z.string().min(1),
  businessDate: z.string().min(1),
  openingFloat: z.coerce.number().min(0),
  cashCounted: z.coerce.number().min(0),
  cardTotal: z.coerce.number().min(0),
  otherTotal: z.coerce.number().min(0),
  expectedCash: z.string().optional(),
  notes: z.string().optional(),
});

export async function createCashClose(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (!canAccessLocal(user, d.localId)) return { error: "Sin permiso sobre ese local." };
  const date = new Date(d.businessDate + "T00:00:00Z");
  if (isNaN(date.getTime())) return { error: "Fecha no válida." };

  const c = await prisma.cashClose.create({
    data: {
      localId: d.localId,
      businessDate: date,
      openingFloat: d.openingFloat,
      cashCounted: d.cashCounted,
      cardTotal: d.cardTotal,
      otherTotal: d.otherTotal,
      expectedCash: d.expectedCash ? Number(d.expectedCash) : null,
      notes: d.notes || null,
      createdById: user.id,
      createdByEmail: user.email,
    },
  });
  await audit({ ...auditContext(user), localId: d.localId, action: "cashclose.create", entity: "CashClose", entityId: c.id, detail: { date: d.businessDate } });
  revalidatePath("/cash");
  return { ok: true };
}
