"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { clientIp } from "@/lib/auth";

const schema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  lastName: z.string().min(1, "Apellidos requeridos"),
  phone: z.string().min(1, "Teléfono requerido"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  nif: z.string().optional(),
  ssNumber: z.string().optional(),
  iban: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  contractType: z.enum(["INDEFINIDO", "TEMPORAL", "FIJO_DISCONTINUO", "FORMACION", "PRACTICAS"]),
  weeklyHours: z.coerce.number().min(0).max(60),
});

export type SubmitResult = { error?: string; ok?: boolean };

/** Sin auth a propósito: es el formulario público al que llega el futuro empleado por el enlace. */
export async function submitRegistration(token: string, _prev: SubmitResult, formData: FormData): Promise<SubmitResult> {
  const reg = await prisma.employeeRegistration.findUnique({ where: { token } });
  if (!reg) return { error: "Enlace no válido." };
  if (reg.status !== "PENDIENTE") return { error: "Esta solicitud ya se ha decidido." };
  if (reg.expiresAt < new Date()) return { error: "Este enlace ha caducado. Pide uno nuevo a tu responsable." };
  if (reg.submittedAt) return { error: "Ya has enviado tus datos. Un responsable los revisará en breve." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos no válidos." };
  const d = parsed.data;
  const startDate = new Date(`${d.startDate}T00:00:00.000Z`);
  if (isNaN(startDate.getTime())) return { error: "Fecha de inicio no válida." };

  await prisma.employeeRegistration.update({
    where: { id: reg.id },
    data: {
      submittedAt: new Date(),
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      startDate,
      nif: d.nif || null,
      ssNumber: d.ssNumber || null,
      iban: d.iban || null,
      emergencyContact: d.emergencyContact || null,
      emergencyPhone: d.emergencyPhone || null,
      contractType: d.contractType,
      weeklyHours: d.weeklyHours,
    },
  });

  await audit({
    localId: reg.localId,
    action: "registration.submit",
    entity: "EmployeeRegistration",
    entityId: reg.id,
    detail: { name: `${d.firstName} ${d.lastName}` },
    ip: clientIp(),
  });

  // Avisa a los admins/encargados del local: hay una solicitud lista para revisar.
  const admins = await prisma.user.findMany({
    where: { active: true, OR: [{ role: "SUPERADMIN" }, { role: "ENCARGADO", localId: reg.localId }] },
    select: { email: true },
  });
  await Promise.all(admins.map((a) => notify(a.email, "Nueva solicitud de alta", `${d.firstName} ${d.lastName} ha completado su alta y está pendiente de revisión.`, "/employees/registrations")));

  revalidatePath(`/join/${token}`);
  return { ok: true };
}
