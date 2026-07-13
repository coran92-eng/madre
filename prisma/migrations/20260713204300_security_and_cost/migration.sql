-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "hourlyCostOverride" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Local" ADD COLUMN     "defaultHourlyCost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "twoFactorVerified" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "totpBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;
