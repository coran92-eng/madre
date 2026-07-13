-- CreateEnum
CREATE TYPE "AppccKind" AS ENUM ('NUMERIC', 'BOOLEAN', 'TEXT');

-- CreateEnum
CREATE TYPE "AppccFrequency" AS ENUM ('POR_TURNO', 'DIARIO', 'SEMANAL');

-- CreateEnum
CREATE TYPE "ChecklistMoment" AS ENUM ('APERTURA', 'CIERRE', 'OTRO');

-- CreateEnum
CREATE TYPE "TipMethod" AS ENUM ('EQUAL', 'BY_HOURS', 'MANUAL');

-- CreateTable
CREATE TABLE "AppccPoint" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" "AppccKind" NOT NULL DEFAULT 'NUMERIC',
    "unit" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "frequency" "AppccFrequency" NOT NULL DEFAULT 'DIARIO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppccPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppccRecord" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "numValue" DOUBLE PRECISION,
    "boolValue" BOOLEAN,
    "textValue" TEXT,
    "ok" BOOLEAN NOT NULL,
    "note" TEXT,
    "recordedById" TEXT,
    "recordedByName" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "AppccRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "moment" "ChecklistMoment" NOT NULL DEFAULT 'APERTURA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRun" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistCheck" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "byId" TEXT,
    "byName" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftLog" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "shift" TEXT,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftLogRead" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftLogRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipPool" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "shift" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "method" "TipMethod" NOT NULL DEFAULT 'EQUAL',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipShare" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TipShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppccPoint_localId_active_idx" ON "AppccPoint"("localId", "active");

-- CreateIndex
CREATE INDEX "AppccRecord_localId_recordedAt_idx" ON "AppccRecord"("localId", "recordedAt");

-- CreateIndex
CREATE INDEX "AppccRecord_pointId_recordedAt_idx" ON "AppccRecord"("pointId", "recordedAt");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_localId_active_idx" ON "ChecklistTemplate"("localId", "active");

-- CreateIndex
CREATE INDEX "ChecklistRun_localId_businessDate_idx" ON "ChecklistRun"("localId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistRun_templateId_businessDate_key" ON "ChecklistRun"("templateId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistCheck_runId_itemId_key" ON "ChecklistCheck"("runId", "itemId");

-- CreateIndex
CREATE INDEX "ShiftLog_localId_businessDate_idx" ON "ShiftLog"("localId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftLogRead_logId_employeeId_key" ON "ShiftLogRead"("logId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "TipPool_localId_businessDate_idx" ON "TipPool"("localId", "businessDate");

-- CreateIndex
CREATE INDEX "TipShare_employeeId_idx" ON "TipShare"("employeeId");

-- AddForeignKey
ALTER TABLE "AppccRecord" ADD CONSTRAINT "AppccRecord_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "AppccPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistCheck" ADD CONSTRAINT "ChecklistCheck_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChecklistRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistCheck" ADD CONSTRAINT "ChecklistCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftLogRead" ADD CONSTRAINT "ShiftLogRead_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ShiftLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipShare" ADD CONSTRAINT "TipShare_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TipPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
