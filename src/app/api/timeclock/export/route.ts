import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { parseMonthKey, monthRange, entryMinutes } from "@/lib/timeclock";

// Registro horario exportable para Inspección de Trabajo y para el empleado (spec §4.4).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const url = new URL(req.url);
  const { year, month } = parseMonthKey(url.searchParams.get("month") ?? undefined);
  const { start, end } = monthRange(year, month);
  const admin = user.role === "SUPERADMIN" || user.role === "ENCARGADO" || user.role === "GESTORIA";

  let where: Record<string, unknown> = { clockIn: { gte: start, lt: end } };
  if (admin) {
    if (user.role !== "SUPERADMIN") where.localId = user.localId;
    const q = url.searchParams.get("local");
    if (user.role === "SUPERADMIN" && q) where.localId = q;
  } else {
    const emp = await prisma.employee.findUnique({ where: { userId: user.id } });
    if (!emp) return new NextResponse("Sin ficha", { status: 403 });
    where.employeeId = emp.id;
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      employee: { select: { firstName: true, lastName: true, nif: true } },
      corrections: { select: { id: true } },
    },
    orderBy: [{ employeeId: "asc" }, { clockIn: "asc" }],
  });

  const rows = [
    ["Empleado", "NIF", "Fecha", "Entrada", "Salida", "Minutos", "Corregido"].join(";"),
    ...entries.map((e) => {
      const mins = entryMinutes(e.clockIn, e.clockOut);
      const d = e.clockIn.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
      const ci = e.clockIn.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
      const co = e.clockOut ? e.clockOut.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) : "";
      return [
        `${e.employee.lastName}, ${e.employee.firstName}`,
        e.employee.nif ?? "",
        d, ci, co, String(mins), e.corrections.length > 0 ? "sí" : "",
      ].join(";");
    }),
  ].join("\n");

  return new NextResponse("﻿" + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registro-horario-${year}-${String(month).padStart(2, "0")}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
