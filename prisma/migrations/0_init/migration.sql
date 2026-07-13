-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ENCARGADO', 'EMPLEADO', 'GESTORIA');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVO', 'BAJA', 'EXCEDENCIA');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('INDEFINIDO', 'TEMPORAL', 'FIJO_DISCONTINUO', 'FORMACION', 'PRACTICAS');

-- CreateEnum
CREATE TYPE "PriorityRule" AS ENUM ('ORDEN_SOLICITUD', 'ANTIGUEDAD', 'ROTACION');

-- CreateEnum
CREATE TYPE "VacationStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NOMINA', 'CONTRATO', 'ANEXO', 'AMONESTACION', 'COMUNICACION', 'OTRO');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('BAJA_MEDICA', 'MATRIMONIO', 'MUDANZA', 'FALLECIMIENTO', 'NACIMIENTO', 'DEBER_PUBLICO', 'LACTANCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ExpiryType" AS ENUM ('CARNET_MANIPULADOR', 'FORMACION_ALERGENOS', 'NIE', 'DNI', 'CONTRATO_TEMPORAL', 'PERIODO_PRUEBA', 'OTRO');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PROPUESTO', 'ACEPTADO_COMPANERO', 'RECHAZADO_COMPANERO', 'APROBADO', 'RECHAZADO_ENCARGADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Local" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "alertLeadDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "localId" TEXT,
    "resetToken" TEXT,
    "resetExpiresAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "localId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" JSONB,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nif" TEXT,
    "ssNumber" TEXT,
    "iban" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "contractType" "ContractType" NOT NULL DEFAULT 'INDEFINIDO',
    "weeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVO',
    "vacationDaysOverride" INTEGER,
    "pinHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationYear" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "daysPerEmployee" INTEGER NOT NULL DEFAULT 30,
    "weeksPerEmployee" INTEGER NOT NULL DEFAULT 5,
    "accrualPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "priorityRule" "PriorityRule" NOT NULL DEFAULT 'ORDEN_SOLICITUD',
    "requestsOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedWeek" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationRequest" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "VacationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationWeek" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "approvedKey" TEXT,

    CONSTRAINT "VacationWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationAdjustment" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "desiredDate" TIMESTAMP(3),
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacationAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "note" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "period" TEXT,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "requiresAck" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAck" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "ackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "DocumentAck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'TABLET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeCorrection" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TIMESTAMP(3),
    "newValue" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "authorId" TEXT,
    "authorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDIENTE',
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "justFileName" TEXT,
    "justStorageKey" TEXT,
    "justMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualSection" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "requiresReadConfirm" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualRead" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "ManualRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "localId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requiresRead" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expiry" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "ExpiryType" NOT NULL,
    "label" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "fileName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClose" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashCounted" DOUBLE PRECISION NOT NULL,
    "cardTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCash" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSwap" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "targetEmployeeId" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PROPUESTO',
    "note" TEXT,
    "companionAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftSwap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleTemplate" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualMedia" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Local_code_key" ON "Local"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "User_localId_idx" ON "User"("localId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_localId_createdAt_idx" ON "AuditLog"("localId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_localId_deletedAt_idx" ON "Employee"("localId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VacationYear_localId_year_key" ON "VacationYear"("localId", "year");

-- CreateIndex
CREATE INDEX "BlockedWeek_localId_year_idx" ON "BlockedWeek"("localId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedWeek_localId_year_week_key" ON "BlockedWeek"("localId", "year", "week");

-- CreateIndex
CREATE INDEX "VacationRequest_localId_year_status_idx" ON "VacationRequest"("localId", "year", "status");

-- CreateIndex
CREATE INDEX "VacationRequest_employeeId_idx" ON "VacationRequest"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "VacationWeek_approvedKey_key" ON "VacationWeek"("approvedKey");

-- CreateIndex
CREATE INDEX "VacationWeek_localId_year_week_idx" ON "VacationWeek"("localId", "year", "week");

-- CreateIndex
CREATE INDEX "VacationAdjustment_employeeId_year_idx" ON "VacationAdjustment"("employeeId", "year");

-- CreateIndex
CREATE INDEX "Shift_localId_date_idx" ON "Shift"("localId", "date");

-- CreateIndex
CREATE INDEX "Shift_employeeId_date_idx" ON "Shift"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Document_localId_employeeId_idx" ON "Document"("localId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAck_documentId_employeeId_key" ON "DocumentAck"("documentId", "employeeId");

-- CreateIndex
CREATE INDEX "TimeEntry_localId_clockIn_idx" ON "TimeEntry"("localId", "clockIn");

-- CreateIndex
CREATE INDEX "TimeEntry_employeeId_clockIn_idx" ON "TimeEntry"("employeeId", "clockIn");

-- CreateIndex
CREATE INDEX "TimeCorrection_timeEntryId_idx" ON "TimeCorrection"("timeEntryId");

-- CreateIndex
CREATE INDEX "Absence_localId_status_idx" ON "Absence"("localId", "status");

-- CreateIndex
CREATE INDEX "Absence_employeeId_idx" ON "Absence"("employeeId");

-- CreateIndex
CREATE INDEX "ManualSection_localId_order_idx" ON "ManualSection"("localId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ManualSection_localId_slug_key" ON "ManualSection"("localId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ManualRead_sectionId_employeeId_version_key" ON "ManualRead"("sectionId", "employeeId", "version");

-- CreateIndex
CREATE INDEX "Announcement_localId_createdAt_idx" ON "Announcement"("localId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_employeeId_key" ON "AnnouncementRead"("announcementId", "employeeId");

-- CreateIndex
CREATE INDEX "Expiry_localId_dueDate_idx" ON "Expiry"("localId", "dueDate");

-- CreateIndex
CREATE INDEX "Expiry_employeeId_idx" ON "Expiry"("employeeId");

-- CreateIndex
CREATE INDEX "Incident_employeeId_idx" ON "Incident"("employeeId");

-- CreateIndex
CREATE INDEX "Incident_localId_date_idx" ON "Incident"("localId", "date");

-- CreateIndex
CREATE INDEX "CashClose_localId_businessDate_idx" ON "CashClose"("localId", "businessDate");

-- CreateIndex
CREATE INDEX "ShiftSwap_localId_status_idx" ON "ShiftSwap"("localId", "status");

-- CreateIndex
CREATE INDEX "ShiftSwap_targetEmployeeId_status_idx" ON "ShiftSwap"("targetEmployeeId", "status");

-- CreateIndex
CREATE INDEX "ScheduleTemplate_localId_idx" ON "ScheduleTemplate"("localId");

-- CreateIndex
CREATE INDEX "ManualMedia_localId_idx" ON "ManualMedia"("localId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationYear" ADD CONSTRAINT "VacationYear_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedWeek" ADD CONSTRAINT "BlockedWeek_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationRequest" ADD CONSTRAINT "VacationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationWeek" ADD CONSTRAINT "VacationWeek_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VacationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationAdjustment" ADD CONSTRAINT "VacationAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAck" ADD CONSTRAINT "DocumentAck_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAck" ADD CONSTRAINT "DocumentAck_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeCorrection" ADD CONSTRAINT "TimeCorrection_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualRead" ADD CONSTRAINT "ManualRead_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ManualSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualRead" ADD CONSTRAINT "ManualRead_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expiry" ADD CONSTRAINT "Expiry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

