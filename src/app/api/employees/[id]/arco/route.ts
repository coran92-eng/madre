import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// Derecho de acceso (RGPD/ARCO §5): export completo de los datos de un empleado.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });
  if (user.role !== "SUPERADMIN" && user.role !== "ENCARGADO") return new NextResponse("Sin permiso", { status: 403 });

  const emp = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      local: { select: { code: true, name: true } },
      user: { select: { email: true, role: true, active: true, createdAt: true } },
      vacationRequests: { include: { weeks: true } },
      vacationAdjustments: true,
      absences: true,
      timeEntries: { include: { corrections: true } },
      documents: { select: { id: true, type: true, title: true, period: true, fileName: true, createdAt: true, acks: true } },
      incidents: true,
      expiries: true,
      manualReads: true,
      announcementReads: true,
    },
  });
  if (!emp || !canAccessLocal(user, emp.localId)) return new NextResponse("No encontrado", { status: 404 });

  await audit({ actorId: user.id, actorEmail: user.email, localId: emp.localId, action: "arco.export", entity: "Employee", entityId: emp.id });

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), employee: emp }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="arco-${emp.lastName}-${emp.id}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
