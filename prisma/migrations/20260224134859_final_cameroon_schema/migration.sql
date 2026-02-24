/*
  Warnings:

  - You are about to drop the column `city` on the `blood_banks` table. All the data in the column will be lost.
  - You are about to drop the column `pincode` on the `blood_banks` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `blood_banks` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `blood_requests` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `blood_requests` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `hospitals` table. All the data in the column will be lost.
  - You are about to drop the column `pincode` on the `hospitals` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `hospitals` table. All the data in the column will be lost.
  - Added the required column `region` to the `blood_banks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `town` to the `blood_banks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `blood_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `town` to the `blood_requests` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `patientGender` on the `blood_requests` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `region` to the `hospitals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `town` to the `hospitals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "blood_banks" DROP COLUMN "city",
DROP COLUMN "pincode",
DROP COLUMN "state",
ADD COLUMN     "neighbourhood" TEXT,
ADD COLUMN     "region" "CameroonRegion" NOT NULL,
ADD COLUMN     "town" TEXT NOT NULL,
ALTER COLUMN "address" DROP NOT NULL;

-- AlterTable
ALTER TABLE "blood_requests" DROP COLUMN "city",
DROP COLUMN "state",
ADD COLUMN     "neighbourhood" TEXT,
ADD COLUMN     "region" "CameroonRegion" NOT NULL,
ADD COLUMN     "town" TEXT NOT NULL,
DROP COLUMN "patientGender",
ADD COLUMN     "patientGender" "Gender" NOT NULL,
ALTER COLUMN "hospitalAddress" DROP NOT NULL,
ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;

-- AlterTable
ALTER TABLE "donors" ALTER COLUMN "neighbourhood" DROP NOT NULL;

-- AlterTable
ALTER TABLE "hospitals" DROP COLUMN "city",
DROP COLUMN "pincode",
DROP COLUMN "state",
ADD COLUMN     "neighbourhood" TEXT,
ADD COLUMN     "region" "CameroonRegion" NOT NULL,
ADD COLUMN     "town" TEXT NOT NULL,
ALTER COLUMN "address" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "blood_banks_region_town_idx" ON "blood_banks"("region", "town");

-- CreateIndex
CREATE INDEX "blood_requests_region_town_idx" ON "blood_requests"("region", "town");

-- CreateIndex
CREATE INDEX "hospitals_region_town_idx" ON "hospitals"("region", "town");
