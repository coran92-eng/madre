import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListScope } from "@/lib/localcontext";

const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// Datos de contratación para la gestoría (spec §3, §7). Admin + gestoría.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });
  if (!["SUPERADMIN", "ENCARGADO", "GESTORIA"].includes(user.role)) {
    return new NextResponse("Sin permiso", { status: 403 });
  }

  const url = new URL(req.url);
  const includeHistoric = url.searchParams.get("historico") === "1";
  const scope = await getListScope(user);

  const employees = await prisma.employee.findMany({
    where: { ...scope, ...(includeHistoric ? {} : { deletedAt: null }) },
    include: { local: { select: { code: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = [
    ["Local", "Apellidos", "Nombre", "NIF/NIE", "NumSS", "IBAN", "Tipo contrato", "Jornada semanal", "Alta", "Fin contrato", "Fin prueba", "Estado"].join(";"),
    ...employees.map((e) =>
      [
        e.local.code, e.lastName, e.firstName, e.nif ?? "", e.ssNumber ?? "", e.iban ?? "",
        e.contractType, String(e.weeklyHours), fmt(e.startDate), fmt(e.endDate), fmt(e.trialEndDate),
        e.deletedAt ? "BAJA" : e.status,
      ].join(";")
    ),
  ].join("\n");

  return new NextResponse("﻿" + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datos-contratacion.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
