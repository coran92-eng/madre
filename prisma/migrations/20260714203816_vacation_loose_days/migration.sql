-- CreateTable
CREATE TABLE "VacationDay" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "approvedKey" TEXT,

    CONSTRAINT "VacationDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VacationDay_approvedKey_key" ON "VacationDay"("approvedKey");

-- CreateIndex
CREATE INDEX "VacationDay_localId_date_idx" ON "VacationDay"("localId", "date");

-- AddForeignKey
ALTER TABLE "VacationDay" ADD CONSTRAINT "VacationDay_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VacationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
