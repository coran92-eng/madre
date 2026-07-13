/**
 * Seed + self-verification.
 *  - Creates a demo local, vacation year, superadmin and employees with logins.
 *  - Exercises the ABSOLUTE anti-overlap rule at the database level.
 *  - Prints the capacity report.
 * Safe to re-run: it upserts by natural keys and clears prior demo vacation data.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const YEAR = 2026;

// ── ISO week helpers (mirror of src/lib/vacations) ──────────────────────────
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const ft = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fDay = (ft.getUTCDay() + 6) % 7;
  ft.setUTCDate(ft.getUTCDate() - fDay + 3);
  return 1 + Math.round((d.getTime() - ft.getTime()) / (7 * 24 * 3600 * 1000));
}
function isoWeeksInYear(year: number): number {
  return isoWeek(new Date(Date.UTC(year, 11, 28)));
}
function weekRange(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = (jan4.getUTCDay() + 6) % 7;
  const w1 = new Date(jan4);
  w1.setUTCDate(jan4.getUTCDate() - dow);
  const start = new Date(w1);
  start.setUTCDate(w1.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}
const key = (localId: string, year: number, week: number) => `${localId}:${year}:${week}`;

async function main() {
  const pw = await bcrypt.hash("madre1234", 12);

  const local = await prisma.local.upsert({
    where: { code: "CDM" },
    update: {},
    create: { code: "CDM", name: "Corte de Manga" },
  });

  // Fase 3: multi-local. Los otros dos locales del grupo (arrancan vacíos).
  await prisma.local.upsert({ where: { code: "SBCN" }, update: {}, create: { code: "SBCN", name: "La Sastrería Barcelona" } });
  await prisma.local.upsert({ where: { code: "SMAD" }, update: {}, create: { code: "SMAD", name: "La Sastrería Madrid" } });

  await prisma.vacationYear.upsert({
    where: { localId_year: { localId: local.id, year: YEAR } },
    update: { requestsOpen: true },
    create: { localId: local.id, year: YEAR, daysPerEmployee: 30, weeksPerEmployee: 5, requestsOpen: true },
  });

  await prisma.user.upsert({
    where: { email: "admin@cortedemanga.es" },
    update: {},
    create: { email: "admin@cortedemanga.es", passwordHash: pw, role: "SUPERADMIN" },
  });

  // Two blocked weeks (temporada alta).
  for (const week of [32, 33]) {
    await prisma.blockedWeek.upsert({
      where: { localId_year_week: { localId: local.id, year: YEAR, week } },
      update: {},
      create: { localId: local.id, year: YEAR, week, reason: "Temporada alta verano" },
    });
  }

  // Employees with logins.
  const people = [
    { firstName: "Ana", lastName: "García", email: "ana@cortedemanga.es", role: "ENCARGADO" as const },
    { firstName: "Bruno", lastName: "López", email: "bruno@cortedemanga.es", role: "EMPLEADO" as const },
    { firstName: "Carla", lastName: "Ruiz", email: "carla@cortedemanga.es", role: "EMPLEADO" as const },
  ];
  const emps: Record<string, string> = {};
  for (const p of people) {
    let emp = await prisma.employee.findFirst({ where: { email: p.email } });
    if (!emp) {
      emp = await prisma.employee.create({
        data: {
          localId: local.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          contractType: "INDEFINIDO",
          weeklyHours: 40,
          startDate: new Date(Date.UTC(2024, 0, 15)),
        },
      });
    }
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: { email: p.email, passwordHash: pw, role: p.role, localId: local.id },
    });
    if (!emp.userId) await prisma.employee.update({ where: { id: emp.id }, data: { userId: user.id } });
    emps[p.firstName] = emp.id;
  }

  // Clean prior demo vacation data for idempotency.
  await prisma.vacationRequest.deleteMany({ where: { localId: local.id, year: YEAR } });

  // Ana requests + approve weeks 30, 31.
  const anaReq = await prisma.vacationRequest.create({
    data: {
      localId: local.id,
      employeeId: emps["Ana"],
      year: YEAR,
      status: "APROBADA",
      weeks: {
        create: [30, 31].map((w) => {
          const { start, end } = weekRange(YEAR, w);
          return { localId: local.id, year: YEAR, week: w, startDate: start, endDate: end, approvedKey: key(local.id, YEAR, w) };
        }),
      },
    },
  });

  // ── VERIFY anti-overlap: Bruno tries to also take week 30 ──
  let overlapBlocked = false;
  try {
    await prisma.vacationRequest.create({
      data: {
        localId: local.id,
        employeeId: emps["Bruno"],
        year: YEAR,
        status: "APROBADA",
        weeks: {
          create: [30].map((w) => {
            const { start, end } = weekRange(YEAR, w);
            return { localId: local.id, year: YEAR, week: w, startDate: start, endDate: end, approvedKey: key(local.id, YEAR, w) };
          }),
        },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") overlapBlocked = true;
    else throw e;
  }

  // Bruno instead takes a free week (34) as a pending request.
  const brunoReq = await prisma.vacationRequest.create({
    data: {
      localId: local.id,
      employeeId: emps["Bruno"],
      year: YEAR,
      status: "PENDIENTE",
      weeks: {
        create: [34].map((w) => {
          const { start, end } = weekRange(YEAR, w);
          return { localId: local.id, year: YEAR, week: w, startDate: start, endDate: end };
        }),
      },
    },
  });

  // ── FASE 2 demo data + verification ──────────────────────────────────────
  const pinHash = await bcrypt.hash("1234", 12);
  await prisma.employee.updateMany({ where: { localId: local.id }, data: { pinHash } });
  // Carla: período de prueba a punto de terminar (alerta).
  await prisma.employee.update({
    where: { id: emps["Carla"] },
    data: { trialEndDate: new Date(Date.now() + 15 * 86400000) },
  });
  // Bruno: carnet de manipulador caduca pronto.
  await prisma.expiry.deleteMany({ where: { localId: local.id } });
  await prisma.expiry.create({
    data: { localId: local.id, employeeId: emps["Bruno"], type: "CARNET_MANIPULADOR", dueDate: new Date(Date.now() + 20 * 86400000) },
  });

  // Manual: sección con confirmación de lectura.
  await prisma.manualSection.deleteMany({ where: { localId: local.id } });
  await prisma.manualSection.create({
    data: { localId: local.id, slug: "alergenos", title: "Carta y alérgenos", order: 1,
      content: "Los 14 alérgenos de declaración obligatoria...\nProtocolo ante consulta de cliente.", requiresReadConfirm: true },
  });

  // Tablón.
  await prisma.announcement.deleteMany({ where: { localId: local.id } });
  await prisma.announcement.create({
    data: { localId: local.id, title: "Reunión de equipo", body: "El lunes a las 11:00 antes de abrir.", requiresRead: true, createdByEmail: "admin@cortedemanga.es" },
  });

  // Ausencia pendiente.
  await prisma.absence.deleteMany({ where: { localId: local.id } });
  await prisma.absence.create({
    data: { localId: local.id, employeeId: emps["Carla"], type: "MUDANZA",
      startDate: new Date(Date.UTC(YEAR, 8, 1)), endDate: new Date(Date.UTC(YEAR, 8, 1)), reason: "Mudanza" },
  });

  // Cierre de caja de ejemplo.
  await prisma.cashClose.deleteMany({ where: { localId: local.id } });
  await prisma.cashClose.create({
    data: { localId: local.id, businessDate: new Date(), openingFloat: 150, cashCounted: 842.5, cardTotal: 1210.0, expectedCash: 840, createdByEmail: "admin@cortedemanga.es" },
  });

  // ── VERIFY fichaje: entrada→salida + corrección anotada ──
  await prisma.timeEntry.deleteMany({ where: { localId: local.id } });
  const t0 = new Date(Date.UTC(YEAR, 0, 10, 8, 0));
  const t1 = new Date(Date.UTC(YEAR, 0, 10, 16, 0));
  const entry = await prisma.timeEntry.create({
    data: { localId: local.id, employeeId: emps["Ana"], clockIn: t0, clockOut: t1, source: "TABLET" },
  });
  const corrected = new Date(Date.UTC(YEAR, 0, 10, 16, 30));
  await prisma.timeCorrection.create({
    data: { timeEntryId: entry.id, field: "clockOut", oldValue: t1, newValue: corrected, reason: "Cierre real 16:30", authorEmail: "admin@cortedemanga.es" },
  });
  await prisma.timeEntry.update({ where: { id: entry.id }, data: { clockOut: corrected } });
  const corrCount = await prisma.timeCorrection.count({ where: { timeEntryId: entry.id } });
  const finalEntry = await prisma.timeEntry.findUnique({ where: { id: entry.id } });
  const correctionOk = corrCount === 1 && finalEntry?.clockOut?.getTime() === corrected.getTime();

  // Capacity math.
  const active = await prisma.employee.count({ where: { localId: local.id, deletedAt: null, status: "ACTIVO" } });
  const blocked = await prisma.blockedWeek.count({ where: { localId: local.id, year: YEAR } });
  const totalWeeks = isoWeeksInYear(YEAR);
  const required = active * 5;
  const available = totalWeeks - blocked;

  console.log("─".repeat(60));
  console.log("SEED OK");
  console.log(`  Local: ${local.name} (${local.code})`);
  console.log(`  Superadmin: admin@cortedemanga.es / madre1234`);
  console.log(`  Empleados: ana@, bruno@, carla@ (contraseña: madre1234)`);
  console.log(`  Ana aprobada: semanas 30, 31   (req ${anaReq.id.slice(0, 8)})`);
  console.log(`  Bruno pendiente: semana 34      (req ${brunoReq.id.slice(0, 8)})`);
  console.log("─".repeat(60));
  console.log(`  Fase 2: PIN de fichaje = 1234 · manual, tablón, ausencia, caja y caducidades sembrados`);
  console.log("─".repeat(60));
  console.log("VERIFICACIÓN");
  console.log(`  [${overlapBlocked ? "PASS" : "FAIL"}] Anti-solapamiento: 2º intento sobre semana 30 rechazado por la BD`);
  console.log(`  [${correctionOk ? "PASS" : "FAIL"}] Fichaje: corrección anotada + valor actualizado (banco de horas)`);
  console.log(`  Capacidad ${YEAR}: ${required} necesarias / ${available} disponibles (${totalWeeks}-${blocked}) → ${required <= available ? "CABE" : "NO CABE"}`);
  console.log("─".repeat(60));

  if (!overlapBlocked || !correctionOk) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
