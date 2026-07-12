"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext, clientIp } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { randomUUID } from "crypto";
import path from "path";
import { audit } from "@/lib/audit";
import { saveFile } from "@/lib/storage";

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "seccion";
}

const schema = z.object({
  localId: z.string().min(1),
  title: z.string().min(2, "Título requerido"),
  content: z.string().min(1, "Contenido requerido"),
  order: z.coerce.number().int().default(0),
  requiresReadConfirm: z.string().optional(),
});

export async function createSection(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (!canAccessLocal(user, d.localId)) return { error: "Sin permiso." };

  let slug = slugify(d.title);
  const exists = await prisma.manualSection.findUnique({ where: { localId_slug: { localId: d.localId, slug } } });
  if (exists) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  const s = await prisma.manualSection.create({
    data: {
      localId: d.localId, slug, title: d.title, content: d.content,
      order: d.order, requiresReadConfirm: d.requiresReadConfirm === "on", createdById: user.id,
    },
  });
  await audit({ ...auditContext(user), localId: d.localId, action: "manual.section.create", entity: "ManualSection", entityId: s.id });
  redirect("/manual/edit");
}

export async function updateSection(
  id: string,
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const current = await prisma.manualSection.findUnique({ where: { id } });
  if (!current || !canAccessLocal(user, current.localId)) return { error: "Sin permiso." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  // Bump version when content changes → obliga a relectura (spec §4.6).
  const contentChanged = current.content !== d.content;
  await prisma.manualSection.update({
    where: { id },
    data: {
      title: d.title, content: d.content, order: d.order,
      requiresReadConfirm: d.requiresReadConfirm === "on",
      version: contentChanged ? current.version + 1 : current.version,
    },
  });
  await audit({ ...auditContext(user), localId: current.localId, action: "manual.section.update", entity: "ManualSection", entityId: id, detail: { contentChanged } });
  revalidatePath("/manual");
  return { ok: true };
}

export async function deleteSection(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const s = await prisma.manualSection.findUnique({ where: { id } });
  if (!s || !canAccessLocal(user, s.localId)) throw new Error("Sin permiso.");
  await prisma.manualSection.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: s.localId, action: "manual.section.delete", entity: "ManualSection", entityId: id });
  redirect("/manual/edit");
}

/** Employee confirms having read a section (records version + date/time/IP). */
export async function confirmRead(sectionId: string): Promise<void> {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) throw new Error("Sin ficha de empleado.");
  const section = await prisma.manualSection.findUnique({ where: { id: sectionId } });
  if (!section) throw new Error("Sección no encontrada.");

  await prisma.manualRead.upsert({
    where: { sectionId_employeeId_version: { sectionId, employeeId: employee.id, version: section.version } },
    create: { sectionId, employeeId: employee.id, version: section.version, ip: clientIp() },
    update: {},
  });
  await audit({ ...auditContext(user), localId: section.localId, action: "manual.read", entity: "ManualSection", entityId: sectionId, detail: { version: section.version } });
  revalidatePath("/manual");
}

// ── Imágenes del manual (spec §4.6) ─────────────────────────────────────────

export async function uploadManualImage(formData: FormData): Promise<{ error?: string; url?: string }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const localId = String(formData.get("localId") ?? "");
  if (!canAccessLocal(user, localId)) return { error: "Sin permiso." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Adjunta una imagen." };
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return { error: "Solo PNG, JPG, WEBP o GIF." };
  if (file.size > 8 * 1024 * 1024) return { error: "La imagen supera 8 MB." };

  const ext = path.extname(file.name) || ".img";
  const storageKey = `${localId}/manual/${randomUUID()}${ext}`;
  await saveFile(storageKey, Buffer.from(await file.arrayBuffer()));
  const media = await prisma.manualMedia.create({
    data: { localId, fileName: file.name, storageKey, mimeType: file.type, createdById: user.id },
  });
  await audit({ ...auditContext(user), localId, action: "manual.media.upload", entity: "ManualMedia", entityId: media.id });
  return { url: `/api/manual/media/${media.id}` };
}
