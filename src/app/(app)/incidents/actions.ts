"use server";

import { randomUUID } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { saveFile } from "@/lib/storage";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);

const schema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  category: z.string().optional(),
  description: z.string().min(3, "Describe la incidencia"),
});

export async function addIncident(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const emp = await prisma.employee.findUnique({ where: { id: d.employeeId } });
  if (!emp || !canAccessLocal(user, emp.localId)) return { error: "Empleado no válido." };
  const date = new Date(d.date + "T00:00:00Z");
  if (isNaN(date.getTime())) return { error: "Fecha no válida." };

  let fileName: string | null = null;
  let storageKey: string | null = null;
  let mimeType: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: "El adjunto supera 12 MB." };
    if (!ALLOWED.has(file.type)) return { error: "Adjunto: solo PDF, PNG o JPG." };
    const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : "");
    storageKey = `${emp.localId}/${emp.id}/incident-${randomUUID()}${ext}`;
    await saveFile(storageKey, Buffer.from(await file.arrayBuffer()));
    fileName = file.name;
    mimeType = file.type;
  }

  const inc = await prisma.incident.create({
    data: {
      localId: emp.localId, employeeId: emp.id, date,
      category: d.category || null, description: d.description,
      fileName, storageKey, mimeType, createdById: user.id,
    },
  });
  await audit({ ...auditContext(user), localId: emp.localId, action: "incident.create", entity: "Incident", entityId: inc.id });
  revalidatePath("/incidents");
  revalidatePath(`/employees/${emp.id}`);
  return { ok: true };
}

export async function deleteIncident(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc || !canAccessLocal(user, inc.localId)) throw new Error("Sin permiso.");
  await prisma.incident.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: inc.localId, action: "incident.delete", entity: "Incident", entityId: id });
  revalidatePath("/incidents");
  revalidatePath(`/employees/${inc.employeeId}`);
}
