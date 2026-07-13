import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { readFile } from "@/lib/storage";

// Incidencias: solo admin/encargado del local (spec §4.11).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });
  if (user.role !== "SUPERADMIN" && user.role !== "ENCARGADO") return new NextResponse("Sin permiso", { status: 403 });

  const inc = await prisma.incident.findUnique({ where: { id: params.id } });
  if (!inc || !inc.storageKey) return new NextResponse("No encontrado", { status: 404 });
  if (!canAccessLocal(user, inc.localId)) return new NextResponse("Sin permiso", { status: 403 });

  let data: Buffer;
  try {
    data = await readFile(inc.storageKey);
  } catch {
    return new NextResponse("Archivo no disponible", { status: 410 });
  }
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": inc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(inc.fileName ?? "adjunto")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
