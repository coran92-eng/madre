import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListScope } from "@/lib/localcontext";
import { parseMonthKey, monthRange } from "@/lib/timeclock";

// Registro APPCC exportable para Sanidad / inspección.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const url = new URL(req.url);
  const { year, month } = parseMonthKey(url.searchParams.get("month") ?? undefined);
  const { start, end } = monthRange(year, month);
  const scope = await getListScope(user);

  const records = await prisma.appccRecord.findMany({
    where: { ...scope, recordedAt: { gte: start, lt: end } },
    include: { point: { select: { name: true, category: true, unit: true, kind: true } } },
    orderBy: { recordedAt: "asc" },
  });

  const fmt = (d: Date) => d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" });
  const value = (r: (typeof records)[number]) =>
    r.point.kind === "NUMERIC" ? `${r.numValue ?? ""}${r.point.unit ?? ""}` : r.point.kind === "BOOLEAN" ? (r.boolValue ? "Sí" : "No") : r.textValue ?? "";

  const rows = [
    ["Fecha/hora", "Punto", "Categoría", "Valor", "Conforme", "Registró", "Nota"].join(";"),
    ...records.map((r) => [fmt(r.recordedAt), r.point.name, r.point.category, value(r), r.ok ? "Sí" : "NO", r.recordedByName ?? "", (r.note ?? "").replace(/;/g, ",")].join(";")),
  ].join("\n");

  return new NextResponse("﻿" + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="appcc-${year}-${String(month).padStart(2, "0")}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
