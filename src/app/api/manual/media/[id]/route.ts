import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { readFile } from "@/lib/storage";

// Imágenes del manual: cualquier usuario autenticado con acceso al local.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const media = await prisma.manualMedia.findUnique({ where: { id: params.id } });
  if (!media) return new NextResponse("No encontrado", { status: 404 });
  if (!canAccessLocal(user, media.localId)) return new NextResponse("Sin permiso", { status: 403 });

  let data: Buffer;
  try {
    data = await readFile(media.storageKey);
  } catch {
    return new NextResponse("No disponible", { status: 410 });
  }
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": media.mimeType, "Cache-Control": "private, max-age=3600" },
  });
}
