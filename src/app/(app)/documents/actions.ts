"use server";

import { randomUUID } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext, clientIp } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { saveFile } from "@/lib/storage";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);

const metaSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["NOMINA", "CONTRATO", "ANEXO", "AMONESTACION", "COMUNICACION", "OTRO"]),
  title: z.string().min(2, "Título requerido"),
  period: z.string().optional(),
  requiresAck: z.string().optional(),
});

export async function uploadDocument(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO", "GESTORIA");
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Adjunta un archivo." };
  if (file.size > MAX_BYTES) return { error: "El archivo supera 12 MB." };
  if (!ALLOWED.has(file.type)) return { error: "Formato no permitido (PDF, PNG o JPG)." };

  const emp = await prisma.employee.findUnique({ where: { id: d.employeeId } });
  if (!emp || !canAccessLocal(user, emp.localId)) return { error: "Empleado no válido." };

  const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : "");
  const storageKey = `${emp.localId}/${emp.id}/${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await saveFile(storageKey, buf);

  const doc = await prisma.document.create({
    data: {
      localId: emp.localId,
      employeeId: emp.id,
      type: d.type,
      title: d.title,
      period: d.period || null,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      sizeBytes: file.size,
      requiresAck: d.requiresAck === "on",
      uploadedById: user.id,
    },
  });

  await audit({ ...auditContext(user), localId: emp.localId, action: "document.upload", entity: "Document", entityId: doc.id, detail: { type: d.type, employee: emp.id } });
  revalidatePath("/documents");
  return { ok: true };
}

/** Firma digital simple: clic + fecha/hora/IP (spec §4.5). */
export async function acknowledgeDocument(documentId: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) return { error: "Sin ficha de empleado." };

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.employeeId !== employee.id) return { error: "Documento no encontrado." };

  await prisma.documentAck.upsert({
    where: { documentId_employeeId: { documentId, employeeId: employee.id } },
    create: { documentId, employeeId: employee.id, ip: clientIp() },
    update: {},
  });
  await audit({ ...auditContext(user), localId: doc.localId, action: "document.ack", entity: "Document", entityId: documentId });
  revalidatePath("/documents");
  return { ok: true };
}
