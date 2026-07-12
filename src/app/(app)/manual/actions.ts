"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, auditContext, clientIp } from "@/lib/auth";
import { canAccessLocal, localScope } from "@/lib/rbac";
import { audit } from "@/lib/audit";

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
