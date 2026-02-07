-- DropIndex
DROP INDEX "blood_banks_licenseNumber_key";

-- DropIndex
DROP INDEX "hospitals_licenseNumber_key";

-- AlterTable
ALTER TABLE "blood_banks" ALTER COLUMN "licenseNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "hospitals" ALTER COLUMN "licenseNumber" DROP NOT NULL;
