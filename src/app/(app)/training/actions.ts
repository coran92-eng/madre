"use server";

import { randomUUID } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, auditContext } from "@/lib/auth";
import { canAccessLocal } from "@/lib/rbac";
import { getActiveLocalId } from "@/lib/localcontext";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { saveFile } from "@/lib/storage";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);

/** completedOn + n meses, en UTC. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Corrige desbordes de mes (p.ej. 31 ene + 1 mes → 3 mar) fijando al último día.
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

const courseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Indica el nombre del curso"),
  validityMonths: z.string().optional(),
});

export async function saveCourse(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  let validityMonths: number | null = null;
  if (d.validityMonths && d.validityMonths.trim() !== "") {
    const n = Number(d.validityMonths);
    if (!Number.isInteger(n) || n <= 0) return { error: "La validez debe ser un número de meses positivo." };
    validityMonths = n;
  }

  if (d.id) {
    const existing = await prisma.course.findUnique({ where: { id: d.id } });
    if (!existing || !canAccessLocal(user, existing.localId)) return { error: "Curso no válido." };
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: { name: d.name, validityMonths },
    });
    await audit({ ...auditContext(user), localId: course.localId, action: "course.update", entity: "Course", entityId: course.id });
  } else {
    const localId = await getActiveLocalId(user);
    if (!localId || !canAccessLocal(user, localId)) return { error: "Selecciona un local válido." };
    const course = await prisma.course.create({
      data: { localId, name: d.name, validityMonths, createdById: user.id },
    });
    await audit({ ...auditContext(user), localId, action: "course.create", entity: "Course", entityId: course.id });
  }

  revalidatePath("/training");
  return { ok: true };
}

export async function toggleCourse(id: string, active: boolean): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course || !canAccessLocal(user, course.localId)) throw new Error("Sin permiso.");
  await prisma.course.update({ where: { id }, data: { active } });
  await audit({ ...auditContext(user), localId: course.localId, action: active ? "course.activate" : "course.deactivate", entity: "Course", entityId: id });
  revalidatePath("/training");
}

const completionSchema = z.object({
  courseId: z.string().min(1),
  employeeId: z.string().min(1),
  completedOn: z.string().min(1),
});

export async function recordCompletion(
  _prev: { error?: string; ok?: boolean },
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const parsed = completionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const [course, emp] = await Promise.all([
    prisma.course.findUnique({ where: { id: d.courseId } }),
    prisma.employee.findUnique({ where: { id: d.employeeId } }),
  ]);
  if (!course || !canAccessLocal(user, course.localId)) return { error: "Curso no válido." };
  if (!emp || !canAccessLocal(user, emp.localId)) return { error: "Empleado no válido." };
  if (emp.localId !== course.localId) return { error: "El curso y el empleado deben ser del mismo local." };

  const completedOn = new Date(d.completedOn + "T00:00:00Z");
  if (isNaN(completedOn.getTime())) return { error: "Fecha no válida." };
  const expiresOn = course.validityMonths ? addMonths(completedOn, course.validityMonths) : null;

  let fileName: string | null = null;
  let storageKey: string | null = null;
  let mimeType: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: "El adjunto supera 12 MB." };
    if (!ALLOWED.has(file.type)) return { error: "Adjunto: solo PDF, PNG o JPG." };
    const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : "");
    storageKey = `${emp.localId}/${emp.id}/course-${randomUUID()}${ext}`;
    await saveFile(storageKey, Buffer.from(await file.arrayBuffer()));
    fileName = file.name;
    mimeType = file.type;
  }

  const completion = await prisma.courseCompletion.create({
    data: {
      localId: emp.localId, courseId: course.id, employeeId: emp.id,
      completedOn, expiresOn, fileName, storageKey, mimeType, createdById: user.id,
    },
  });
  await audit({ ...auditContext(user), localId: emp.localId, action: "courseCompletion.create", entity: "CourseCompletion", entityId: completion.id });

  await notify(
    emp.email,
    "Formación registrada",
    `Se ha registrado tu formación "${course.name}" con fecha ${completedOn.toLocaleDateString("es-ES", { timeZone: "UTC" })}.`,
    "/training"
  );

  revalidatePath("/training");
  revalidatePath(`/employees/${emp.id}`);
  return { ok: true };
}

export async function deleteCompletion(id: string): Promise<void> {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const completion = await prisma.courseCompletion.findUnique({ where: { id } });
  if (!completion || !canAccessLocal(user, completion.localId)) throw new Error("Sin permiso.");
  await prisma.courseCompletion.delete({ where: { id } });
  await audit({ ...auditContext(user), localId: completion.localId, action: "courseCompletion.delete", entity: "CourseCompletion", entityId: id });
  revalidatePath("/training");
  revalidatePath(`/employees/${completion.employeeId}`);
}
