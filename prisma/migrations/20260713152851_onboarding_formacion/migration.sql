-- CreateTable
CREATE TABLE "OnboardingTemplate" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OnboardingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingCheck" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "byId" TEXT,
    "byName" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validityMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCompletion" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "completedOn" TIMESTAMP(3) NOT NULL,
    "expiresOn" TIMESTAMP(3),
    "fileName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingTemplate_localId_active_idx" ON "OnboardingTemplate"("localId", "active");

-- CreateIndex
CREATE INDEX "OnboardingCheck_localId_employeeId_idx" ON "OnboardingCheck"("localId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCheck_employeeId_itemId_key" ON "OnboardingCheck"("employeeId", "itemId");

-- CreateIndex
CREATE INDEX "Course_localId_active_idx" ON "Course"("localId", "active");

-- CreateIndex
CREATE INDEX "CourseCompletion_employeeId_idx" ON "CourseCompletion"("employeeId");

-- CreateIndex
CREATE INDEX "CourseCompletion_localId_expiresOn_idx" ON "CourseCompletion"("localId", "expiresOn");

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCheck" ADD CONSTRAINT "OnboardingCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "OnboardingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCompletion" ADD CONSTRAINT "CourseCompletion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
