import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { readFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return new NextResponse("No encontrado", { status: 404 });

  // Access: admins over the local, or the owning employee.
  const isAdmin = user.role === "SUPERADMIN" || user.role === "ENCARGADO" || user.role === "GESTORIA";
  let allowed = isAdmin && canAccessLocal(user, doc.localId);
  if (!allowed) {
    const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
    allowed = !!employee && employee.id === doc.employeeId;
  }
  if (!allowed) return new NextResponse("Sin permiso", { status: 403 });

  let data: Buffer;
  try {
    data = await readFile(doc.storageKey);
  } catch {
    return new NextResponse("Archivo no disponible", { status: 410 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
