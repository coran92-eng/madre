import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListScope } from "@/lib/localcontext";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { CourseForm, ToggleCourse, CompletionForm, DeleteCompletion } from "./TrainingClient";

export const dynamic = "force-dynamic";

function expiryState(expiresOn: Date | null, now: Date): { label: string; cls: string } {
  if (!expiresOn) return { label: "Sin caducidad", cls: "bg-stone-100 text-stone-700" };
  const days = Math.round((expiresOn.getTime() - now.getTime()) / 86400000);
  if (days < 0) return { label: "Caducado", cls: "bg-red-100 text-red-700" };
  if (days <= 30) return { label: `Caduca en ${days} d`, cls: "bg-amber-100 text-amber-800" };
  return { label: "Vigente", cls: "bg-green-100 text-green-800" };
}

export default async function TrainingPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const scope = await getListScope(user);

  const [courses, completions, employees] = await Promise.all([
    prisma.course.findMany({
      where: { ...scope },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.courseCompletion.findMany({
      where: { ...scope },
      include: { course: { select: { name: true } } },
      orderBy: { completedOn: "desc" },
      take: 100,
    }),
    prisma.employee.findMany({
      where: { ...scope, deletedAt: null },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const empName = new Map(employees.map((e) => [e.id, `${e.lastName}, ${e.firstName}`]));
  const activeCourses = courses.filter((c) => c.active);
  const now = new Date();

  return (
    <>
      <PageHeader title="Formación y PRL" subtitle="Cursos, certificados y renovaciones · solo admin" />

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-900 mb-3">Cursos</h2>
        <div className="mb-4">
          <CourseForm />
        </div>
        {courses.length === 0 ? (
          <EmptyState>No hay cursos definidos.</EmptyState>
        ) : (
          <div className="space-y-2">
            {courses.map((c) => (
              <div key={c.id} className="card p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {c.name}
                    {!c.active && <span className="ml-2 badge bg-stone-200 text-stone-600">Inactivo</span>}
                  </div>
                  <div className="text-xs text-stone-400">
                    {c.validityMonths ? `Renovación cada ${c.validityMonths} meses` : "Sin caducidad"}
                  </div>
                </div>
                <ToggleCourse id={c.id} active={c.active} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-stone-900 mb-3">Formación completada</h2>
        {activeCourses.length > 0 && employees.length > 0 ? (
          <div className="mb-4">
            <CompletionForm
              courses={activeCourses.map((c) => ({ id: c.id, name: c.name }))}
              employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))}
            />
          </div>
        ) : (
          <p className="text-sm text-stone-500 mb-4">Necesitas al menos un curso activo y un empleado para registrar formación.</p>
        )}

        {completions.length === 0 ? (
          <EmptyState>No hay formación registrada.</EmptyState>
        ) : (
          <div className="space-y-2">
            {completions.map((c) => {
              const st = expiryState(c.expiresOn, now);
              return (
                <div key={c.id} className="card p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{empName.get(c.employeeId) ?? "—"}</div>
                    <div className="text-xs text-stone-400">
                      {c.course.name} · Realizado {fmtDate(c.completedOn)}
                      {c.expiresOn ? ` · Caduca ${fmtDate(c.expiresOn)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {c.storageKey && <a href={`/api/training/${c.id}/file`} target="_blank" className="text-madre hover:underline text-xs">Certificado</a>}
                    <DeleteCompletion id={c.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
