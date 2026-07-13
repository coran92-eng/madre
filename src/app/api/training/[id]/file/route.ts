import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { readFile } from "@/lib/storage";

// Certificado de formación: admin/encargado del local o el propio empleado dueño.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const completion = await prisma.courseCompletion.findUnique({ where: { id: params.id } });
  if (!completion || !completion.storageKey) return new NextResponse("No encontrado", { status: 404 });

  const isAdmin = (user.role === "SUPERADMIN" || user.role === "ENCARGADO") && canAccessLocal(user, completion.localId);
  let isOwner = false;
  if (!isAdmin) {
    const emp = await prisma.employee.findUnique({ where: { id: completion.employeeId }, select: { userId: true } });
    isOwner = !!emp && emp.userId === user.id;
  }
  if (!isAdmin && !isOwner) return new NextResponse("Sin permiso", { status: 403 });

  let data: Buffer;
  try {
    data = await readFile(completion.storageKey);
  } catch {
    return new NextResponse("Archivo no disponible", { status: 410 });
  }
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": completion.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(completion.fileName ?? "certificado")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
