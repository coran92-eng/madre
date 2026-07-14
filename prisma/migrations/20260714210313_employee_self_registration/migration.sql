-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "EmployeeRegistration" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "submittedAt" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "nif" TEXT,
    "ssNumber" TEXT,
    "iban" TEXT,
    "phone" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "contractType" "ContractType",
    "weeklyHours" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRegistration_token_key" ON "EmployeeRegistration"("token");

-- CreateIndex
CREATE INDEX "EmployeeRegistration_localId_status_idx" ON "EmployeeRegistration"("localId", "status");
