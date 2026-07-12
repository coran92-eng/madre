"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { needsSetup } from "@/lib/bootstrap";
import { hashPassword, createSession, clientIp } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  email: z.string().email("Email no válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  localCode: z.string().min(2, "Código del local requerido").max(12),
  localName: z.string().min(2, "Nombre del local requerido"),
  year: z.coerce.number().int().min(2024).max(2100),
  daysPerEmployee: z.coerce.number().int().min(1).max(60),
  weeksPerEmployee: z.coerce.number().int().min(1).max(12),
});

export type SetupState = { error?: string };

export async function runSetup(
  _prev: SetupState,
  formData: FormData
): Promise<SetupState> {
  // Guard: the wizard only runs while no superadmin exists.
  if (!(await needsSetup())) {
    return { error: "La aplicación ya está configurada." };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) return { error: "Ese email ya está en uso." };

  const user = await prisma.$transaction(async (tx) => {
    const local = await tx.local.create({
      data: { code: d.localCode.toUpperCase(), name: d.localName },
    });
    await tx.vacationYear.create({
      data: {
        localId: local.id,
        year: d.year,
        daysPerEmployee: d.daysPerEmployee,
        weeksPerEmployee: d.weeksPerEmployee,
      },
    });
    return tx.user.create({
      data: {
        email: d.email.toLowerCase(),
        passwordHash: await hashPassword(d.password),
        role: "SUPERADMIN",
        // Superadmin no está atado a un local (acceso a todos).
      },
    });
  });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "setup.complete",
    entity: "User",
    entityId: user.id,
    detail: { local: d.localCode, year: d.year },
    ip: clientIp(),
  });

  await createSession(user.id);
  redirect("/dashboard");
}
