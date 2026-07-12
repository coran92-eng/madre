import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { readFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const abs = await prisma.absence.findUnique({ where: { id: params.id } });
  if (!abs || !abs.justStorageKey) return new NextResponse("No encontrado", { status: 404 });

  const isAdmin = user.role === "SUPERADMIN" || user.role === "ENCARGADO";
  let allowed = isAdmin && canAccessLocal(user, abs.localId);
  if (!allowed) {
    const emp = await prisma.employee.findUnique({ where: { userId: user.id } });
    allowed = !!emp && emp.id === abs.employeeId;
  }
  if (!allowed) return new NextResponse("Sin permiso", { status: 403 });

  let data: Buffer;
  try {
    data = await readFile(abs.justStorageKey);
  } catch {
    return new NextResponse("Archivo no disponible", { status: 410 });
  }
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": abs.justMimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(abs.justFileName ?? "justificante")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
