import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveLocalId } from "@/lib/localcontext";
import { PageHeader } from "@/components/ui";
import { PointForm, TogglePoint } from "../AppccClient";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = {
  TEMPERATURA: "Temperatura", RECEPCION: "Recepción", LIMPIEZA: "Limpieza",
  ACEITE: "Aceite freidora", TRAZABILIDAD: "Trazabilidad", OTRO: "Otro",
};

export default async function AppccConfigPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const localId = await getActiveLocalId(user);
  if (!localId) return <p>No hay local configurado.</p>;

  const points = await prisma.appccPoint.findMany({
    where: { localId },
    orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="APPCC · Puntos de control"
        subtitle="Configura qué se controla, con qué umbrales y frecuencia"
        action={<Link href="/appcc" className="btn-secondary">Volver</Link>}
      />
      <div className="mb-6"><PointForm localId={localId} /></div>

      {points.length === 0 ? (
        <p className="text-sm text-stone-500">Todavía no hay puntos de control.</p>
      ) : (
        <div className="card divide-y divide-stone-100">
          {points.map((p) => (
            <div key={p.id} className={`p-3 flex items-center justify-between ${p.active ? "" : "opacity-50"}`}>
              <div>
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-stone-400 ml-2">
                  {CAT_LABEL[p.category]} · {p.kind === "NUMERIC" ? `${p.minValue ?? "—"}…${p.maxValue ?? "—"}${p.unit ?? ""}` : p.kind === "BOOLEAN" ? "sí/no" : "texto"} · {p.frequency.toLowerCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/appcc/config/${p.id}`} className="text-madre hover:underline text-sm">Editar</Link>
                <TogglePoint id={p.id} active={p.active} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
