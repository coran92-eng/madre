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
    create: { code: "CDM", name: "Corte de Manga", defaultHourlyCost: 14.5 },
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

  // Carla toma 2 días sueltos (no semana completa) — demuestra el reparto de
  // días naturales que no encajan en semanas enteras (p.ej. 30 días = 4
  // semanas + 2 sueltos), y que el saldo cuenta 1 día = 1 día, no ×7.
  const looseDay1 = new Date(Date.UTC(YEAR, 4, 13)); // mié 13 may 2026
  const looseDay2 = new Date(Date.UTC(YEAR, 4, 14)); // jue 14 may 2026
  const dayKey = (d: Date) => `${local.id}:${d.toISOString().slice(0, 10)}`;
  await prisma.vacationRequest.create({
    data: {
      localId: local.id,
      employeeId: emps["Carla"],
      year: YEAR,
      status: "APROBADA",
      days: {
        create: [looseDay1, looseDay2].map((date) => ({
          localId: local.id, year: YEAR, date, approvedKey: dayKey(date),
        })),
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

  // ── Corazón del bar: APPCC, checklist, parte de turno, propinas ──
  await prisma.appccPoint.deleteMany({ where: { localId: local.id } });
  await prisma.appccPoint.create({ data: { localId: local.id, name: "Nevera 1", category: "TEMPERATURA", kind: "NUMERIC", unit: "°C", minValue: 0, maxValue: 4, frequency: "POR_TURNO", order: 1 } });
  await prisma.appccPoint.create({ data: { localId: local.id, name: "Limpieza cierre", category: "LIMPIEZA", kind: "BOOLEAN", frequency: "DIARIO", order: 2 } });

  await prisma.checklistTemplate.deleteMany({ where: { localId: local.id } });
  const chk = await prisma.checklistTemplate.create({
    data: {
      localId: local.id, name: "Apertura de barra", moment: "APERTURA", order: 1,
      items: { create: [{ label: "Encender cafetera", order: 0 }, { label: "Cuadrar caja / fondo", order: 1 }, { label: "Revisar cámaras y temperaturas", order: 2 }] },
    },
  });

  await prisma.shiftLog.deleteMany({ where: { localId: local.id } });
  await prisma.shiftLog.create({ data: { localId: local.id, businessDate: new Date(new Date().toDateString()), shift: "Tarde", body: "Se acabó el hielo, pedir mañana. Mesa 4 dejó a deber 20€.", authorName: "Ana García" } });

  await prisma.tipPool.deleteMany({ where: { localId: local.id } });
  const tipTotal = 90;
  const parts = [emps["Ana"], emps["Bruno"], emps["Carla"]];
  const per = Math.round((tipTotal / parts.length) * 100) / 100;
  const pool = await prisma.tipPool.create({
    data: {
      localId: local.id, businessDate: new Date(), totalAmount: tipTotal, method: "EQUAL", shift: "Noche",
      shares: { create: parts.map((id) => ({ employeeId: id, amount: per })) },
    },
    include: { shares: true },
  });
  const tipsSum = Math.round(pool.shares.reduce((a, s) => a + s.amount, 0) * 100) / 100;
  const tipsOk = Math.abs(tipsSum - tipTotal) < 0.011; // 90/3 = 30 exacto

  // ── Nivel 2: onboarding + formación ──
  await prisma.onboardingTemplate.deleteMany({ where: { localId: local.id } });
  const onb = await prisma.onboardingTemplate.create({
    data: {
      localId: local.id, name: "Incorporación CDM",
      items: { create: [
        { label: "Contrato firmado", order: 0 },
        { label: "Uniformidad entregada", order: 1 },
        { label: "PIN de fichaje configurado", order: 2 },
        { label: "Lectura del manual confirmada", order: 3 },
        { label: "Formación de manipulador vigente", order: 4 },
      ] },
    },
    include: { items: true },
  });
  // Carla (incorporación reciente): 2 tareas hechas.
  for (const it of onb.items.slice(0, 2)) {
    await prisma.onboardingCheck.create({ data: { localId: local.id, employeeId: emps["Carla"], itemId: it.id, done: true, byName: "Ana García" } });
  }

  await prisma.course.deleteMany({ where: { localId: local.id } });
  const manip = await prisma.course.create({ data: { localId: local.id, name: "Manipulador de alimentos", validityMonths: 48 } });
  await prisma.course.create({ data: { localId: local.id, name: "Alérgenos", validityMonths: 24 } });
  // Bruno hizo el de manipulador hace 47 meses → renovación en ~1 mes (sale en /alerts).
  const completed = new Date(); completed.setMonth(completed.getMonth() - 47);
  const expires = new Date(completed); expires.setMonth(expires.getMonth() + 48);
  await prisma.courseCompletion.create({ data: { localId: local.id, courseId: manip.id, employeeId: emps["Bruno"], completedOn: completed, expiresOn: expires } });

  // Capacity math.
  const active = await prisma.employee.count({ where: { localId: local.id, deletedAt: null, status: "ACTIVO" } });
  const blocked = await prisma.blockedWeek.count({ where: { localId: local.id, year: YEAR } });
  const totalWeeks = isoWeeksInYear(YEAR);
  const required = active * 5;
  const available = totalWeeks - blocked;

  const carlaDays = await prisma.vacationDay.count({
    where: { request: { employeeId: emps["Carla"], year: YEAR }, approvedKey: { not: null } },
  });
  const looseDaysOk = carlaDays === 2;

  console.log("─".repeat(60));
  console.log("SEED OK");
  console.log(`  Local: ${local.name} (${local.code})`);
  console.log(`  Superadmin: admin@cortedemanga.es / madre1234`);
  console.log(`  Empleados: ana@, bruno@, carla@ (contraseña: madre1234)`);
  console.log(`  Ana aprobada: semanas 30, 31   (req ${anaReq.id.slice(0, 8)})`);
  console.log(`  Bruno pendiente: semana 34      (req ${brunoReq.id.slice(0, 8)})`);
  console.log(`  Carla aprobada: 2 días sueltos (13-14 may)`);
  console.log("─".repeat(60));
  console.log(`  Fase 2: PIN de fichaje = 1234 · manual, tablón, ausencia, caja y caducidades sembrados`);
  console.log(`  Corazón del bar: 2 puntos APPCC, checklist de apertura, parte de turno y bote de propinas`);
  console.log(`  Nivel 2: panel de dirección, onboarding (plantilla + progreso) y formación (cursos + renovación)`);
  console.log("─".repeat(60));
  console.log("VERIFICACIÓN");
  console.log(`  [${overlapBlocked ? "PASS" : "FAIL"}] Anti-solapamiento: 2º intento sobre semana 30 rechazado por la BD`);
  console.log(`  [${correctionOk ? "PASS" : "FAIL"}] Fichaje: corrección anotada + valor actualizado (banco de horas)`);
  console.log(`  [${tipsOk ? "PASS" : "FAIL"}] Propinas: el reparto suma exactamente el total del bote`);
  console.log(`  [${looseDaysOk ? "PASS" : "FAIL"}] Vacaciones: días sueltos de Carla cuentan como 2 d, no 14 (1 semana ≠ suelto)`);
  console.log(`  Capacidad ${YEAR}: ${required} necesarias / ${available} disponibles (${totalWeeks}-${blocked}) → ${required <= available ? "CABE" : "NO CABE"}`);
  console.log("─".repeat(60));

  if (!overlapBlocked || !correctionOk || !tipsOk || !looseDaysOk) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
